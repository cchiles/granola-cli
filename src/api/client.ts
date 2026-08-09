import type {
  ListFoldersOptions,
  ListFoldersOutput,
  ListNotesOptions,
  ListNotesOutput,
  Note,
  NoteSummary,
  Folder,
} from "./types"

const DEFAULT_API_BASE = "https://public-api.granola.ai/v1"

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`API error (${status}): ${body}`)
    this.name = "ApiError"
  }
}

/** Test seam for 429 backoff timing. */
export const retryControl = {
  maxRetries: 4,
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  },
  backoffDelay(attempt: number): number {
    const base = Math.min(1000 * 2 ** attempt, 8000)
    return base + Math.random() * 250
  },
}

function apiBase(): string {
  return process.env.GRANOLA_API_BASE?.replace(/\/$/, "") || DEFAULT_API_BASE
}

export async function apiRequest<T>(
  apiKey: string,
  path: string,
  params?: URLSearchParams
): Promise<T> {
  const url = params?.toString() ? `${apiBase()}${path}?${params}` : `${apiBase()}${path}`

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (res.status === 429 && attempt < retryControl.maxRetries) {
      await retryControl.sleep(retryControl.backoffDelay(attempt))
      continue
    }

    if (!res.ok) {
      const body = await res.text()
      throw new ApiError(res.status, body)
    }

    return res.json() as Promise<T>
  }
}

export async function listNotes(
  apiKey: string,
  opts: ListNotesOptions = {}
): Promise<ListNotesOutput> {
  const p = new URLSearchParams()
  p.set("page_size", String(opts.limit ?? 10))
  if (opts.createdBefore) p.set("created_before", opts.createdBefore)
  if (opts.createdAfter) p.set("created_after", opts.createdAfter)
  if (opts.updatedAfter) p.set("updated_after", opts.updatedAfter)
  if (opts.folderId) p.set("folder_id", opts.folderId)
  if (opts.cursor) p.set("cursor", opts.cursor)
  return apiRequest<ListNotesOutput>(apiKey, "/notes", p)
}

export async function getNote(
  apiKey: string,
  id: string,
  opts: { transcript?: boolean } = {}
): Promise<Note> {
  const p = new URLSearchParams()
  if (opts.transcript) p.set("include", "transcript")
  return apiRequest<Note>(apiKey, `/notes/${id}`, p.toString() ? p : undefined)
}

export async function listFolders(
  apiKey: string,
  opts: ListFoldersOptions = {}
): Promise<ListFoldersOutput> {
  const p = new URLSearchParams()
  p.set("page_size", String(opts.limit ?? 10))
  if (opts.cursor) p.set("cursor", opts.cursor)
  return apiRequest<ListFoldersOutput>(apiKey, "/folders", p)
}

export async function fetchAllNotes(
  apiKey: string,
  opts: Omit<ListNotesOptions, "cursor" | "limit"> = {}
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

export async function fetchAllFolders(apiKey: string): Promise<Folder[]> {
  const allFolders: Folder[] = []
  let cursor: string | undefined
  do {
    const data = await listFolders(apiKey, { limit: 30, cursor })
    allFolders.push(...data.folders)
    cursor = data.hasMore && data.cursor ? data.cursor : undefined
    if (cursor) console.error(`Fetched ${allFolders.length} folders...`)
  } while (cursor)
  return allFolders
}
