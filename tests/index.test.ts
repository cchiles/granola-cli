import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Import internals we'll export for testing
import {
  loadApiKey,
  saveApiKey,
  listNotes,
  getNote,
  type NoteSummary,
  type Note,
} from "../src/index"

const originalFetch = globalThis.fetch

describe("config", () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "granola-test-"))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it("saveApiKey writes and loadApiKey reads", async () => {
    await saveApiKey("test-key-123", tempDir)
    const key = await loadApiKey(tempDir)
    expect(key).toBe("test-key-123")
  })

  it("loadApiKey returns null when no config exists", async () => {
    const key = await loadApiKey(tempDir)
    expect(key).toBeNull()
  })

  it("GRANOLA_API_KEY env var takes precedence", async () => {
    const orig = process.env.GRANOLA_API_KEY
    process.env.GRANOLA_API_KEY = "env-key"
    await saveApiKey("file-key", tempDir)
    const key = await loadApiKey(tempDir)
    expect(key).toBe("env-key")
    if (orig) process.env.GRANOLA_API_KEY = orig
    else delete process.env.GRANOLA_API_KEY
  })
})

describe("API", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("listNotes sends auth header and returns notes", async () => {
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      expect(init.headers).toHaveProperty("Authorization", "Bearer test-key")
      return new Response(
        JSON.stringify({
          notes: [
            {
              id: "not_1d3tmYTlCICgjy",
              object: "note",
              title: "Standup",
              owner: { name: "Alice", email: "alice@test.com" },
              created_at: "2026-01-27T15:30:00Z",
              updated_at: "2026-01-27T16:45:00Z",
            },
          ],
          hasMore: false,
          cursor: null,
        })
      )
    }) as typeof fetch

    const result = await listNotes("test-key", {})
    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].title).toBe("Standup")
  })

  it("listNotes passes query params", async () => {
    globalThis.fetch = mock(async (url: string) => {
      const parsed = new URL(url)
      expect(parsed.searchParams.get("created_after")).toBe("2026-01-01")
      expect(parsed.searchParams.get("page_size")).toBe("5")
      return new Response(
        JSON.stringify({ notes: [], hasMore: false, cursor: null })
      )
    }) as typeof fetch

    await listNotes("test-key", { createdAfter: "2026-01-01", limit: 5 })
  })

  it("getNote fetches by ID", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          id: "not_1d3tmYTlCICgjy",
          title: "Standup",
          summary_text: "Discussed updates.",
        })
      )
    }) as typeof fetch

    const result = await getNote("test-key", "not_1d3tmYTlCICgjy", {})
    expect(result.title).toBe("Standup")
  })

  it("getNote includes transcript when requested", async () => {
    globalThis.fetch = mock(async (url: string) => {
      expect(url).toContain("include=transcript")
      return new Response(
        JSON.stringify({
          id: "not_1d3tmYTlCICgjy",
          transcript: [{ source: "speaker", text: "Hello" }],
        })
      )
    }) as typeof fetch

    const result = await getNote("test-key", "not_1d3tmYTlCICgjy", {
      transcript: true,
    })
    expect(result.transcript).toHaveLength(1)
  })

  it("throws on 401", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Unauthorized", { status: 401 })
    }) as typeof fetch

    await expect(listNotes("bad-key", {})).rejects.toThrow("401")
  })
})
