# Granola CLI

Granola CLI is a command-line interface for Granola notes. It uses the Granola API to retrieve meeting notes and transcripts from Granola.

## API Documentation
You should always reference the Granola API documentation. This is being updated often, so ensure you are always using the latest.

- https://docs.granola.ai/introduction.md
- https://docs.granola.ai/api-reference/list-notes.md
- https://docs.granola.ai/api-reference/get-note
- https://docs.granola.ai/api-reference/list-folders.md
- https://docs.granola.ai/api-reference/openapi.json

Types in `src/api/types.ts` track the OpenAPI schemas for notes and folders. Keep them in sync when the API changes.

## Architecture
Use Bun for packaging and TypeScript.

Module layout:

- `src/api/` — typed HTTP client and OpenAPI-aligned types
- `src/commands/` — citty subcommands (`list`, `get`, `folders`, `config`, `update`)
- `src/format/` — human-readable output
- `src/config.ts` — API key storage (`GRANOLA_API_KEY` / config file)
- `src/cli.ts` — root command
