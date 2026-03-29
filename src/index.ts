#!/usr/bin/env bun
import { parseArgs } from "node:util"
import { join } from "node:path"
import { homedir } from "node:os"
import { mkdir, chmod } from "node:fs/promises"

// --- Types ---

export interface NoteSummary {
  id: string
  object: string
  title: string | null
  owner: { name: string; email: string }
  created_at: string
  updated_at: string
}

export interface Note extends NoteSummary {
  calendar_event: { title: string | null; start_time: string; end_time: string; organiser: { name: string; email: string } | null } | null
  attendees: { name: string; email: string }[]
  folder_membership: { id: string; name: string }[]
  summary_text: string
  summary_markdown: string | null
  transcript: { source: string; text: string; speaker?: { name: string } }[] | null
}

interface ListResponse {
  notes: NoteSummary[]
  hasMore: boolean
  cursor: string | null
}

// --- Config ---

function configDir(override?: string): string {
  if (override) return override
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  return join(xdg, "granola-cli")
}

export async function saveApiKey(key: string, dirOverride?: string): Promise<void> {
  const dir = configDir(dirOverride)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const path = join(dir, "config.json")
  await Bun.write(path, JSON.stringify({ apiKey: key }))
  await chmod(path, 0o600)
}

export async function loadApiKey(dirOverride?: string): Promise<string | null> {
  const envKey = process.env.GRANOLA_API_KEY
  if (envKey) return envKey

  try {
    const data = await Bun.file(join(configDir(dirOverride), "config.json")).json()
    return data.apiKey ?? null
  } catch {
    return null
  }
}

// --- API ---

const API = "https://public-api.granola.ai/v1"

async function api<T>(apiKey: string, path: string, params?: URLSearchParams): Promise<T> {
  const url = params?.toString() ? `${API}${path}?${params}` : `${API}${path}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error (${res.status}): ${body}`)
  }
  return res.json() as Promise<T>
}

export async function listNotes(
  apiKey: string,
  opts: { createdBefore?: string; createdAfter?: string; cursor?: string; limit?: number }
): Promise<ListResponse> {
  const p = new URLSearchParams()
  p.set("page_size", String(opts.limit ?? 10))
  if (opts.createdBefore) p.set("created_before", opts.createdBefore)
  if (opts.createdAfter) p.set("created_after", opts.createdAfter)
  if (opts.cursor) p.set("cursor", opts.cursor)
  return api<ListResponse>(apiKey, "/notes", p)
}

export async function getNote(
  apiKey: string,
  id: string,
  opts: { transcript?: boolean }
): Promise<Note> {
  const p = new URLSearchParams()
  if (opts.transcript) p.set("include", "transcript")
  return api<Note>(apiKey, `/notes/${id}`, p.toString() ? p : undefined)
}

// --- Formatting ---

function formatList(data: ListResponse): string {
  if (data.notes.length === 0) return "No notes found."

  const lines = data.notes.map((n) => {
    const date = new Date(n.created_at).toLocaleDateString()
    return `  ${n.id}  ${date}  ${n.title ?? "Untitled"}  (${n.owner.name})`
  })

  return lines.join("\n")
}

function formatNote(note: Note): string {
  const lines: string[] = [
    `# ${note.title ?? "Untitled"}`,
    "",
    `ID:      ${note.id}`,
    `Owner:   ${note.owner.name} <${note.owner.email}>`,
    `Created: ${new Date(note.created_at).toLocaleString()}`,
    `Updated: ${new Date(note.updated_at).toLocaleString()}`,
  ]

  if (note.attendees.length > 0) {
    lines.push("", "Attendees:", ...note.attendees.map((a) => `  - ${a.name} <${a.email}>`))
  }

  if (note.summary_text) {
    lines.push("", "## Summary", "", note.summary_text)
  }

  if (note.transcript) {
    lines.push("", "## Transcript", "")
    for (const entry of note.transcript) {
      const speaker = entry.speaker?.name ?? entry.source
      lines.push(`[${speaker}]: ${entry.text}`)
    }
  }

  return lines.join("\n")
}

// --- Date shortcuts ---

const DATE_SHORTCUTS: Record<string, () => { after: string; before: string }> = {
  today: () => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const end = new Date(start.getTime() + 86400000)
    return { after: start.toISOString(), before: end.toISOString() }
  },
  yesterday: () => {
    const d = new Date()
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const start = new Date(end.getTime() - 86400000)
    return { after: start.toISOString(), before: end.toISOString() }
  },
  this_week: () => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
    const end = new Date(start.getTime() + 7 * 86400000)
    return { after: start.toISOString(), before: end.toISOString() }
  },
  last_week: () => {
    const d = new Date()
    const day = d.getDay()
    const thisWeekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
    const start = new Date(thisWeekStart.getTime() - 7 * 86400000)
    return { after: start.toISOString(), before: thisWeekStart.toISOString() }
  },
  this_month: () => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return { after: start.toISOString(), before: end.toISOString() }
  },
  last_month: () => {
    const d = new Date()
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1)
    const end = new Date(d.getFullYear(), d.getMonth(), 1)
    return { after: start.toISOString(), before: end.toISOString() }
  },
}

const RELATIVE_PATTERN = /^(\d+)([dwm])$/

function resolveRelativeRange(input: string): { after: string; before: string } | null {
  const match = input.match(RELATIVE_PATTERN)
  if (!match) return null
  const count = parseInt(match[1], 10)
  const unit = match[2]
  const now = new Date()
  const start = new Date(now)

  if (unit === "d") {
    start.setDate(start.getDate() - count)
  } else if (unit === "w") {
    start.setDate(start.getDate() - count * 7)
  } else if (unit === "m") {
    start.setMonth(start.getMonth() - count)
  }

  return { after: start.toISOString(), before: now.toISOString() }
}

export function resolveDateRange(input: string): { after: string; before: string } | null {
  return DATE_SHORTCUTS[input]?.() ?? resolveRelativeRange(input) ?? null
}

async function fetchAllNotes(
  apiKey: string,
  opts: { createdBefore?: string; createdAfter?: string }
): Promise<NoteSummary[]> {
  const allNotes: NoteSummary[] = []
  let cursor: string | undefined
  do {
    const data = await listNotes(apiKey, { ...opts, limit: 30, cursor })
    allNotes.push(...data.notes)
    cursor = data.hasMore && data.cursor ? data.cursor : undefined
    if (cursor) console.error(`Fetched ${allNotes.length} notes...`)
  } while (cursor)
  return allNotes
}

// --- CLI ---

const DATE_RANGE_VALUES = Object.keys(DATE_SHORTCUTS).join(", ")

const HELP = `granola - CLI for Granola meeting notes

Usage: granola <command> [options]

Commands:
  config [api-key]          Configure API key (prompts if no key given)
  list                      List meeting notes
  get <note-id> [...]       Get one or more meeting notes by ID
  update                    Update to the latest version

Options:
  --help, -h                Show help
  --version, -v             Show version

List options:
  --date-range <range>      ${DATE_RANGE_VALUES}, or relative: 2d, 3w, 2m
  --from <date>             Filter: created after date
  --to <date>               Filter: created before date
  --cursor <cursor>         Pagination cursor
  --limit <n>               Notes per page (1-30, default 10)
  --all                     Fetch all notes (auto-paginates)
  --json                    Output raw JSON

Get options:
  <note-id> [...]           One or more note IDs
  --date-range <range>      Fetch full details for all notes in range
  --transcript              Include transcript
  --json                    Output raw JSON

Auth:
  Run "granola config" or set GRANOLA_API_KEY env var.`

async function main() {
  const args = Bun.argv.slice(2)
  const command = args[0]

  if (!command || command === "--help" || command === "-h") {
    console.log(HELP)
    return
  }
  if (command === "--version" || command === "-v") {
    console.log("0.1.1")
    return
  }

  if (command === "config") {
    let key = args[1]
    if (!key) {
      console.error("Configure your Granola API key.\n")
      console.error("To get your key:")
      console.error("  1. Open the Granola desktop app")
      console.error("  2. Go to Settings > API")
      console.error("  3. Click \"Create new key\"\n")
      process.stderr.write("Paste your API key: ")
      for await (const chunk of console) {
        key = chunk.trim()
        break
      }
      if (!key) {
        console.error("No key provided.")
        process.exit(2)
      }
    }
    await saveApiKey(key)
    console.log("API key saved.")
    return
  }

  if (command === "update") {
    const res = await fetch("https://api.github.com/repos/cchiles/granola-cli/releases/latest")
    if (!res.ok) {
      console.error("Failed to check for updates.")
      process.exit(1)
    }
    const release = (await res.json()) as { tag_name: string }
    const latest = release.tag_name.replace(/^v/, "")
    const current = "0.1.3"

    if (latest === current) {
      console.log(`Already on the latest version (${current}).`)
      return
    }

    console.log(`Updating: ${current} → ${latest}`)
    const proc = Bun.spawn(["bash", "-c", "curl -fsSL https://raw.githubusercontent.com/cchiles/granola-cli/main/install.sh | bash"], {
      stdout: "inherit",
      stderr: "inherit",
    })
    const exitCode = await proc.exited
    if (exitCode !== 0) {
      console.error("Update failed.")
      process.exit(1)
    }
    return
  }

  const apiKey = await loadApiKey()
  if (!apiKey) {
    console.error('No API key. Run "granola config" or set GRANOLA_API_KEY.')
    process.exit(1)
  }

  if (command === "list") {
    const { values } = parseArgs({
      args: args.slice(1),
      options: {
        "date-range": { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "string", default: "10" },
        all: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
      },
      strict: false,
    })

    if (values["date-range"]) {
      const range = resolveDateRange(values["date-range"])
      if (!range) {
        console.error(`Unknown date range: "${values["date-range"]}". Valid: ${DATE_RANGE_VALUES}`)
        process.exit(2)
      }
      const notes = await fetchAllNotes(apiKey, { createdAfter: range.after, createdBefore: range.before })
      const result: ListResponse = { notes, hasMore: false, cursor: null }
      console.log(values.json ? JSON.stringify(result, null, 2) : formatList(result))
      return
    }

    const baseOpts = {
      createdBefore: values.to,
      createdAfter: values.from,
      limit: values.all ? 30 : parseInt(values.limit!, 10),
    }

    if (values.all) {
      const notes = await fetchAllNotes(apiKey, baseOpts)
      const result: ListResponse = { notes, hasMore: false, cursor: null }
      console.log(values.json ? JSON.stringify(result, null, 2) : formatList(result))
    } else {
      const data = await listNotes(apiKey, { ...baseOpts, cursor: values.cursor })
      console.log(values.json ? JSON.stringify(data, null, 2) : formatList(data))
    }
    return
  }

  if (command === "get") {
    const { values, positionals } = parseArgs({
      args: args.slice(1),
      options: {
        "date-range": { type: "string" },
        transcript: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
      },
      allowPositionals: true,
    })

    let noteIds = positionals

    if (values["date-range"]) {
      const range = resolveDateRange(values["date-range"])
      if (!range) {
        console.error(`Unknown date range: "${values["date-range"]}". Valid: ${DATE_RANGE_VALUES}`)
        process.exit(2)
      }
      const summaries = await fetchAllNotes(apiKey, { createdAfter: range.after, createdBefore: range.before })
      if (summaries.length === 0) {
        console.log("No notes found.")
        return
      }
      console.error(`Fetching ${summaries.length} note(s)...`)
      noteIds = summaries.map((n) => n.id)
    }

    if (noteIds.length === 0) {
      console.error("Usage: granola get <note-id> [...] [--date-range <range>] [--transcript] [--json]")
      process.exit(2)
    }

    const notes = await Promise.all(
      noteIds.map((id) => getNote(apiKey, id, { transcript: values.transcript }))
    )

    if (values.json) {
      console.log(JSON.stringify(notes.length === 1 ? notes[0] : notes, null, 2))
    } else {
      console.log(notes.map(formatNote).join("\n\n---\n\n"))
    }
    return
  }

  console.error(`Unknown command: "${command}". Run "granola --help" for usage.`)
  process.exit(2)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`error: ${err.message}`)
    process.exit(1)
  })
}
