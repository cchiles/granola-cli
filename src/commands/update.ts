import { defineCommand } from "citty"
import { VERSION } from "../version"

export default defineCommand({
  meta: {
    name: "update",
    description: "Update to the latest version",
  },
  async run() {
    const res = await fetch("https://api.github.com/repos/cchiles/granola-cli/releases/latest")
    if (!res.ok) {
      console.error("Failed to check for updates.")
      process.exit(1)
    }
    const release = (await res.json()) as { tag_name: string }
    const latest = release.tag_name.replace(/^v/, "")
    const current = VERSION

    if (latest === current) {
      console.log(`Already on the latest version (${current}).`)
      return
    }

    console.log(`Updating: ${current} → ${latest}`)
    const proc = Bun.spawn(
      ["bash", "-c", "curl -fsSL https://raw.githubusercontent.com/cchiles/granola-cli/main/install.sh | bash"],
      {
        stdout: "inherit",
        stderr: "inherit",
      }
    )
    const exitCode = await proc.exited
    if (exitCode !== 0) {
      console.error("Update failed.")
      process.exit(1)
    }
  },
})
