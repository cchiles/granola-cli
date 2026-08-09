import { defineCommand } from "citty"
import { fetchAllNotes, getNote } from "../api/client"
import { requireApiKey } from "../config"
import { DATE_RANGE_VALUES, resolveDateRange } from "../dates"
import { formatNote } from "../format/notes"

export default defineCommand({
  meta: {
    name: "get",
    description: "Get one or more meeting notes by ID",
  },
  args: {
    noteId: {
      type: "positional",
      description: "Note ID (not_...)",
      required: false,
    },
    dateRange: {
      type: "string",
      description: `Fetch full details for all notes in range (${DATE_RANGE_VALUES}, or relative: 2d, 3w, 2m)`,
    },
    transcript: {
      type: "boolean",
      description: "Include transcript",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Output raw JSON",
      default: false,
    },
  },
  async run({ args }) {
    const apiKey = await requireApiKey()

    // citty puts positionals in both args.noteId and args._; prefer args._
    let noteIds = args._.filter((v): v is string => typeof v === "string")
    if (noteIds.length === 0 && args.noteId) noteIds = [args.noteId]

    if (args.dateRange) {
      const range = resolveDateRange(args.dateRange)
      if (!range) {
        console.error(`Unknown date range: "${args.dateRange}". Valid: ${DATE_RANGE_VALUES}`)
        process.exit(2)
      }
      const summaries = await fetchAllNotes(apiKey, {
        createdAfter: range.after,
        createdBefore: range.before,
      })
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
      noteIds.map((id) => getNote(apiKey, id, { transcript: args.transcript }))
    )

    if (args.json) {
      console.log(JSON.stringify(notes.length === 1 ? notes[0] : notes, null, 2))
    } else {
      console.log(notes.map(formatNote).join("\n\n---\n\n"))
    }
  },
})
