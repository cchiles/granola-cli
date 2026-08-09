import { defineCommand } from "citty"
import { VERSION } from "./version"
import config from "./commands/config"
import list from "./commands/list"
import get from "./commands/get"
import folders from "./commands/folders"
import update from "./commands/update"

export const main = defineCommand({
  meta: {
    name: "granola",
    version: VERSION,
    description: "CLI for Granola meeting notes",
  },
  subCommands: {
    config,
    list,
    get,
    folders,
    update,
  },
})
