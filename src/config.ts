import { join } from "node:path"
import { homedir } from "node:os"
import { mkdir, chmod } from "node:fs/promises"

function configDir(override?: string): string {
  if (override) return override
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
  return join(xdg, "granola-cli")
}

export async function saveApiKey(key: string, dirOverride?: string): Promise<void> {
  const dir = configDir(dirOverride)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const path = join(dir, "config.json")
  await Bun.write(path, JSON.stringify({ apiKey: key }))
  await chmod(path, 0o600)
}

export async function loadApiKey(dirOverride?: string): Promise<string | null> {
  const envKey = process.env.GRANOLA_API_KEY
  if (envKey) return envKey

  try {
    const data = await Bun.file(join(configDir(dirOverride), "config.json")).json()
    return data.apiKey ?? null
  } catch {
    return null
  }
}

export async function requireApiKey(): Promise<string> {
  const apiKey = await loadApiKey()
  if (!apiKey) {
    console.error('No API key. Run "granola config" or set GRANOLA_API_KEY.')
    process.exit(1)
  }
  return apiKey
}
