import { defineCommand } from "citty"
import { fetchAllNotes, listNotes } from "../api/client"
import type { ListNotesOutput } from "../api/types"
import { requireApiKey } from "../config"
import { DATE_RANGE_VALUES, resolveDateRange } from "../dates"
import { formatList } from "../format/notes"

export default defineCommand({
  meta: {
    name: "list",
    description: "List meeting notes",
  },
  args: {
    dateRange: {
      type: "string",
      description: `Date range shortcut (${DATE_RANGE_VALUES}, or relative: 2d, 3w, 2m)`,
    },
    from: {
      type: "string",
      description: "Filter: created after date",
    },
    to: {
      type: "string",
      description: "Filter: created before date",
    },
    updatedAfter: {
      type: "string",
      description: "Filter: updated after date",
    },
    folderId: {
      type: "string",
      description: "Filter: folder ID (fol_...)",
    },
    cursor: {
      type: "string",
      description: "Pagination cursor",
    },
    limit: {
      type: "string",
      description: "Notes per page (1-30, default 10)",
      default: "10",
    },
    all: {
      type: "boolean",
      description: "Fetch all notes (auto-paginates)",
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

    if (args.dateRange) {
      const range = resolveDateRange(args.dateRange)
      if (!range) {
        console.error(`Unknown date range: "${args.dateRange}". Valid: ${DATE_RANGE_VALUES}`)
        process.exit(2)
      }
      const notes = await fetchAllNotes(apiKey, {
        createdAfter: range.after,
        createdBefore: range.before,
        updatedAfter: args.updatedAfter,
        folderId: args.folderId,
      })
      const result: ListNotesOutput = { notes, hasMore: false, cursor: null }
      console.log(args.json ? JSON.stringify(result, null, 2) : formatList(result))
      return
    }

    const baseOpts = {
      createdBefore: args.to,
      createdAfter: args.from,
      updatedAfter: args.updatedAfter,
      folderId: args.folderId,
      limit: args.all ? 30 : parseInt(args.limit!, 10),
    }

    if (args.all) {
      const notes = await fetchAllNotes(apiKey, baseOpts)
      const result: ListNotesOutput = { notes, hasMore: false, cursor: null }
      console.log(args.json ? JSON.stringify(result, null, 2) : formatList(result))
      return
    }

    const data = await listNotes(apiKey, { ...baseOpts, cursor: args.cursor })
    console.log(args.json ? JSON.stringify(data, null, 2) : formatList(data))
  },
})
