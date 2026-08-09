import { defineCommand } from "citty"
import { fetchAllFolders, listFolders } from "../api/client"
import type { ListFoldersOutput } from "../api/types"
import { requireApiKey } from "../config"
import { formatFolders } from "../format/folders"

export default defineCommand({
  meta: {
    name: "folders",
    description: "List accessible folders",
  },
  args: {
    cursor: {
      type: "string",
      description: "Pagination cursor",
    },
    limit: {
      type: "string",
      description: "Folders per page (1-30, default 10)",
      default: "10",
    },
    all: {
      type: "boolean",
      description: "Fetch all folders (auto-paginates)",
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

    if (args.all) {
      const folders = await fetchAllFolders(apiKey)
      const result: ListFoldersOutput = { folders, hasMore: false, cursor: null }
      console.log(args.json ? JSON.stringify(result, null, 2) : formatFolders(result))
      return
    }

    const data = await listFolders(apiKey, {
      cursor: args.cursor,
      limit: parseInt(args.limit!, 10),
    })
    console.log(args.json ? JSON.stringify(data, null, 2) : formatFolders(data))
  },
})
