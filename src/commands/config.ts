import { defineCommand } from "citty"
import { saveApiKey } from "../config"

export default defineCommand({
  meta: {
    name: "config",
    description: "Configure API key (prompts if no key given)",
  },
  args: {
    apiKey: {
      type: "positional",
      description: "API key to save",
      required: false,
    },
  },
  async run({ args }) {
    let key = args.apiKey
    if (!key) {
      console.error("Configure your Granola API key.\n")
      console.error("To get your key:")
      console.error("  1. Open the Granola desktop app")
      console.error("  2. Go to Settings → Connectors → API keys")
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
  },
})
