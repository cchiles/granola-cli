# granola-cli

A simple CLI for [Granola](https://granola.ai) meeting notes.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/cchiles/granola-cli/main/install.sh | bash
```

Downloads a pre-built binary and installs to `/usr/local/bin`.

## Setup

```bash
granola config
```

This will prompt you for your API key with instructions on where to find it.

You can also pass the key directly or use an environment variable:

```bash
granola config YOUR_API_KEY
export GRANOLA_API_KEY=YOUR_API_KEY
```

## Usage

```bash
# List recent notes
granola list
granola list --limit 20 --created-after 2025-01-01
granola list --json | jq '.notes[].title'

# Get a specific note
granola get not_1d3tmYTlCICgjy
granola get not_1d3tmYTlCICgjy --transcript
granola get not_1d3tmYTlCICgjy --json > note.json
```

Run `granola --help` for all options.

## Uninstall

```bash
sudo rm /usr/local/bin/granola
rm -rf ~/.config/granola-cli
```
