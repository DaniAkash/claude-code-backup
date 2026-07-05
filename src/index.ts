#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { registerBackup } from "./commands/backup.ts";
import { BackupError } from "./lib/errors.ts";
import { VERSION } from "./lib/version.ts";

export function buildProgram(): Command {
  const program = new Command()
    .name("claude-code-backup")
    .description("Snapshot Claude Code history and config into a timestamped backup")
    .version(VERSION);
  registerBackup(program);
  return program;
}

export async function main(argv: readonly string[]): Promise<number> {
  const program = buildProgram();
  program.exitOverride();
  try {
    await program.parseAsync(argv as string[]);
    return 0;
  } catch (err) {
    if (err instanceof BackupError) {
      process.stderr.write(`error: ${err.message}\n`);
      return 1;
    }
    if (isCommanderExit(err)) {
      return typeof err.exitCode === "number" ? err.exitCode : 0;
    }
    if (err instanceof Error) {
      process.stderr.write(`error: ${err.message}\n`);
      return 1;
    }
    throw err;
  }
}

type CommanderExit = { code: string; exitCode?: number };

function isCommanderExit(err: unknown): err is CommanderExit {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && code.startsWith("commander.");
}

function isDirectInvocation(): boolean {
  const entry = process.argv[1];
  if (typeof entry !== "string" || entry.length === 0) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  void main(process.argv).then((code) => {
    process.exit(code);
  });
}
