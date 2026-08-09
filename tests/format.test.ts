import { describe, it, expect } from "bun:test"
import { formatTranscriptSpeaker, formatNote } from "../src/format/notes"
import { formatFolders } from "../src/format/folders"
import type { Note, Speaker } from "../src/api/types"
import noteMacos from "./fixtures/note-macos.json"
import noteIos from "./fixtures/note-ios.json"
import listFolders from "./fixtures/list-folders.json"

describe("formatTranscriptSpeaker", () => {
  it("prefers name over diarization_label and attribution", () => {
    const speaker: Speaker = {
      source: "microphone",
      attribution: "me",
      diarization_label: "Speaker A",
      name: "Alice Smith",
    }
    expect(formatTranscriptSpeaker(speaker)).toBe("Alice Smith")
  })

  it("uses diarization_label when name is absent", () => {
    const speaker: Speaker = {
      source: "microphone",
      diarization_label: "Speaker A",
    }
    expect(formatTranscriptSpeaker(speaker)).toBe("Speaker A")
  })

  it("uses attribution when only attribution is present", () => {
    const speaker: Speaker = {
      source: "speaker",
      attribution: "them",
    }
    expect(formatTranscriptSpeaker(speaker)).toBe("them")
  })

  it("falls back to source", () => {
    const speaker: Speaker = { source: "microphone" }
    expect(formatTranscriptSpeaker(speaker)).toBe("microphone")
  })
})

describe("formatNote", () => {
  it("formats macOS transcript with attribution labels", () => {
    const out = formatNote(noteMacos as Note)
    expect(out).toContain("URL:     https://notes.granola.ai")
    expect(out).toContain("Event:   Quarterly yoghurt budget review")
    expect(out).toContain("## Quarterly Yoghurt Budget Review")
    expect(out).toContain("[me]: I'm done pretending")
    expect(out).toContain("[them]: Finally. Regular yoghurt")
  })

  it("formats iOS transcript with diarization and resolved names", () => {
    const out = formatNote(noteIos as Note)
    expect(out).toContain("[Speaker A]: I'm done pretending")
    expect(out).toContain("[Alice Smith]: Finally. Regular yoghurt")
    expect(out).toContain("Unknown <guest@granola.ai>")
    expect(out).toContain("Discussed yoghurt strategy.")
  })
})

describe("formatFolders", () => {
  it("includes parent folder id when present", () => {
    const out = formatFolders(listFolders)
    expect(out).toContain("fol_4y6LduVdwSKC27")
    expect(out).toContain("Top secret recipes")
    expect(out).toContain("parent=fol_a74g2hvl98iUHG")
  })
})
