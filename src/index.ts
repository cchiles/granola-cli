#!/usr/bin/env bun
import { runMain } from "citty"
import { main } from "./cli"

const originalError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  if (args[0] instanceof Error) {
    originalError(`error: ${(args[0] as Error).message}`)
    return
  }
  originalError(...args)
}

await runMain(main)
