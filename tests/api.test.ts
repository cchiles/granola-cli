import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadApiKey, saveApiKey } from "../src/config"
import {
  ApiError,
  getNote,
  listFolders,
  listNotes,
  retryControl,
} from "../src/api/client"
import listNotesFixture from "./fixtures/list-notes.json"
import listFoldersFixture from "./fixtures/list-folders.json"
import noteMacosFixture from "./fixtures/note-macos.json"

const originalFetch = globalThis.fetch
const originalSleep = retryControl.sleep

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
    retryControl.sleep = originalSleep
    delete process.env.GRANOLA_API_BASE
  })

  it("listNotes sends auth header and returns notes", async () => {
    globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toHaveProperty("Authorization", "Bearer test-key")
      return new Response(JSON.stringify(listNotesFixture))
    }) as typeof fetch

    const result = await listNotes("test-key", {})
    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].title).toBe("Standup")
  })

  it("listNotes passes query params including updated_after and folder_id", async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const parsed = new URL(String(url))
      expect(parsed.searchParams.get("created_after")).toBe("2026-01-01")
      expect(parsed.searchParams.get("updated_after")).toBe("2026-01-15")
      expect(parsed.searchParams.get("folder_id")).toBe("fol_4y6LduVdwSKC27")
      expect(parsed.searchParams.get("page_size")).toBe("5")
      return new Response(JSON.stringify({ notes: [], hasMore: false, cursor: null }))
    }) as typeof fetch

    await listNotes("test-key", {
      createdAfter: "2026-01-01",
      updatedAfter: "2026-01-15",
      folderId: "fol_4y6LduVdwSKC27",
      limit: 5,
    })
  })

  it("listFolders hits /folders with auth", async () => {
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain("/v1/folders")
      expect(init?.headers).toHaveProperty("Authorization", "Bearer test-key")
      return new Response(JSON.stringify(listFoldersFixture))
    }) as typeof fetch

    const result = await listFolders("test-key", { limit: 10 })
    expect(result.folders).toHaveLength(1)
    expect(result.folders[0].id).toBe("fol_4y6LduVdwSKC27")
  })

  it("getNote fetches by ID", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify(noteMacosFixture))
    }) as typeof fetch

    const result = await getNote("test-key", "not_1d3tmYTlCICgjy", {})
    expect(result.title).toBe("Quarterly yoghurt budget review")
    expect(result.web_url).toContain("notes.granola.ai")
  })

  it("getNote includes transcript when requested", async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      expect(String(url)).toContain("include=transcript")
      return new Response(JSON.stringify(noteMacosFixture))
    }) as typeof fetch

    const result = await getNote("test-key", "not_1d3tmYTlCICgjy", {
      transcript: true,
    })
    expect(result.transcript).toHaveLength(2)
    expect(result.transcript?.[0].speaker.source).toBe("microphone")
  })

  it("throws on 401", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Unauthorized", { status: 401 })
    }) as typeof fetch

    await expect(listNotes("bad-key", {})).rejects.toBeInstanceOf(ApiError)
    await expect(listNotes("bad-key", {})).rejects.toThrow("401")
  })

  it("retries on 429 then succeeds", async () => {
    let callCount = 0
    retryControl.sleep = async () => {}
    globalThis.fetch = mock(async () => {
      callCount++
      if (callCount === 1) {
        return new Response("Too Many Requests", { status: 429 })
      }
      return new Response(JSON.stringify(listNotesFixture))
    }) as typeof fetch

    const result = await listNotes("test-key", {})
    expect(callCount).toBe(2)
    expect(result.notes).toHaveLength(1)
  })

  it("uses GRANOLA_API_BASE when set", async () => {
    process.env.GRANOLA_API_BASE = "https://example.test/v1"
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      expect(String(url).startsWith("https://example.test/v1/notes")).toBe(true)
      return new Response(JSON.stringify(listNotesFixture))
    }) as typeof fetch

    await listNotes("test-key", {})
  })

  it("getNote fetches multiple IDs concurrently", async () => {
    let callCount = 0
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      callCount++
      const href = String(url)
      const id = href.includes("id-1") ? "id-1" : "id-2"
      return new Response(
        JSON.stringify({
          ...noteMacosFixture,
          id,
          title: `Note ${id}`,
        })
      )
    }) as typeof fetch

    const [n1, n2] = await Promise.all([
      getNote("test-key", "id-1", {}),
      getNote("test-key", "id-2", {}),
    ])
    expect(n1.id).toBe("id-1")
    expect(n2.id).toBe("id-2")
    expect(callCount).toBe(2)
  })
})
