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
  opts: { createdBefore?: string; createdAfter?: string; updatedAfter?: string; cursor?: string; limit?: number }
): Promise<ListResponse> {
  const p = new URLSearchParams()
  p.set("page_size", String(opts.limit ?? 10))
  if (opts.createdBefore) p.set("created_before", opts.createdBefore)
  if (opts.createdAfter) p.set("created_after", opts.createdAfter)
  if (opts.updatedAfter) p.set("updated_after", opts.updatedAfter)
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

// --- CLI ---

const HELP = `granola - CLI for Granola meeting notes

Usage: granola <command> [options]

Commands:
  config [api-key]          Configure API key (prompts if no key given)
  list                      List meeting notes
  get <note-id>             Get a meeting note by ID

Options:
  --help, -h                Show help
  --version, -v             Show version

List options:
  --created-before <date>   Filter by creation date
  --created-after <date>    Filter by creation date
  --updated-after <date>    Filter by update date
  --cursor <cursor>         Pagination cursor
  --limit <n>               Notes per page (1-30, default 10)
  --all                     Fetch all notes (auto-paginates)
  --json                    Output raw JSON

Get options:
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
    console.log("0.1.0")
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

  const apiKey = await loadApiKey()
  if (!apiKey) {
    console.error('No API key. Run "granola config" or set GRANOLA_API_KEY.')
    process.exit(1)
  }

  if (command === "list") {
    const { values } = parseArgs({
      args: args.slice(1),
      options: {
        "created-before": { type: "string" },
        "created-after": { type: "string" },
        "updated-after": { type: "string" },
        cursor: { type: "string" },
        limit: { type: "string", default: "10" },
        all: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
      },
      strict: false,
    })

    const baseOpts = {
      createdBefore: values["created-before"],
      createdAfter: values["created-after"],
      updatedAfter: values["updated-after"],
      limit: values.all ? 30 : parseInt(values.limit!, 10),
    }

    if (values.all) {
      const allNotes: NoteSummary[] = []
      let cursor: string | undefined
      do {
        const data = await listNotes(apiKey, { ...baseOpts, cursor })
        allNotes.push(...data.notes)
        cursor = data.hasMore && data.cursor ? data.cursor : undefined
        if (cursor) console.error(`Fetched ${allNotes.length} notes...`)
      } while (cursor)
      const result: ListResponse = { notes: allNotes, hasMore: false, cursor: null }
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
        transcript: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
      },
      allowPositionals: true,
    })

    const noteId = positionals[0]
    if (!noteId) {
      console.error("Usage: granola get <note-id> [--transcript] [--json]")
      process.exit(2)
    }

    const note = await getNote(apiKey, noteId, { transcript: values.transcript })
    console.log(values.json ? JSON.stringify(note, null, 2) : formatNote(note))
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
