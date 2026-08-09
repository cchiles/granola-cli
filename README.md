# granola-cli

A CLI for [Granola](https://granola.ai) meeting notes, built with Bun and TypeScript.

Types and endpoints track the [Granola public API](https://docs.granola.ai/introduction.md).

## Install

### Homebrew

```bash
brew install cchiles/tap/granola
```

### Script

```bash
curl -fsSL https://raw.githubusercontent.com/cchiles/granola-cli/main/install.sh | bash
```

Installs to `/usr/local/bin` if writable, otherwise `~/.local/bin`. Override with `GRANOLA_INSTALL_DIR`.

## Setup

```bash
granola config
```

This prompts for your API key. Create one in the Granola desktop app under **Settings → Connectors → API keys**.

You can also pass the key directly or use an environment variable:

```bash
granola config YOUR_API_KEY
export GRANOLA_API_KEY=YOUR_API_KEY
```

Optional: override the API base URL with `GRANOLA_API_BASE` (default `https://public-api.granola.ai/v1`).

## Usage

```bash
# List recent notes
granola list
granola list --limit 20 --from 2025-01-01
granola list --from 2025-03-01 --to 2025-03-15
granola list --updated-after 2025-03-01
granola list --folder-id fol_4y6LduVdwSKC27
granola list --json | jq '.notes[].title'

# Quick date ranges (auto-paginates all results)
granola list --date-range today
granola list --date-range yesterday
granola list --date-range this_week
granola list --date-range last_week
granola list --date-range this_month
granola list --date-range last_month

# List folders (for discovering folder IDs)
granola folders
granola folders --all --json

# Get a specific note
granola get not_1d3tmYTlCICgjy
granola get not_1d3tmYTlCICgjy --transcript
granola get not_1d3tmYTlCICgjy --json > note.json

# Get multiple notes at once
granola get id1 id2 id3

# Get full details for all notes in a date range
granola get --date-range today
granola get --date-range last_week --transcript
```

Run `granola --help` for all options.

## Update

```bash
granola update
```

## Uninstall

```bash
rm ~/.local/bin/granola
rm -rf ~/.config/granola-cli
```
