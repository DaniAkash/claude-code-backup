import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Command } from "commander";
import { copyInto, measureSize, pathExists } from "../lib/copy.ts";
import { BackupError } from "../lib/errors.ts";
import { formatBytes } from "../lib/format.ts";
import { type BackupItem, backupItems } from "../lib/manifest.ts";
import { backupTimestamp, defaultClaudeDir, defaultConfigFile } from "../lib/paths.ts";
import { VERSION } from "../lib/version.ts";

interface BackupOptions {
  optional?: boolean;
  claudeDir: string;
  configFile: string;
  dryRun?: boolean;
  quiet?: boolean;
}

interface CapturedItem extends BackupItem {
  bytes: number;
  files: number;
}

interface CaptureResult {
  captured: CapturedItem[];
  skipped: BackupItem[];
  totalBytes: number;
  totalFiles: number;
}

interface ManifestMeta {
  stamp: string;
  claudeDir: string;
  configFile: string;
  includeOptional: boolean;
}

type Logger = (message: string) => void;

export function registerBackup(program: Command): void {
  program
    .argument("<target-directory>", "directory to write the timestamped backup into")
    .option("--optional", "also include optional data (config backups, global CLAUDE.md)")
    .option("--claude-dir <path>", "Claude Code data directory", defaultClaudeDir())
    .option("--config-file <path>", "global .claude.json path", defaultConfigFile())
    .option("--dry-run", "show what would be copied without writing anything")
    .option("--quiet", "only print the final summary")
    .action(async (targetDirectory: string, opts: BackupOptions) => {
      await runBackup(targetDirectory, opts);
    });
}

async function runBackup(targetDirectory: string, opts: BackupOptions): Promise<void> {
  const { claudeDir, configFile } = opts;
  const includeOptional = opts.optional ?? false;
  const dryRun = opts.dryRun ?? false;
  const log: Logger = (message) => {
    if (!opts.quiet) process.stdout.write(`${message}\n`);
  };

  const items = backupItems({ claudeDir, configFile }).filter(
    (item) => item.tier === "core" || includeOptional,
  );
  const stamp = backupTimestamp(new Date());
  const backupRoot = join(targetDirectory, stamp);

  log(`claude-code-backup ${VERSION}${dryRun ? "  (dry run)" : ""}`);
  log(`target: ${backupRoot}`);
  log("");

  const result = await captureItems(items, join(backupRoot, "files"), dryRun, log);
  if (result.captured.length === 0) {
    throw new BackupError(
      `nothing to back up: none of the ${items.length} sources exist under ${claudeDir}`,
      "EMPTY_BACKUP",
    );
  }

  if (!dryRun) {
    await writeManifest(backupRoot, { stamp, claudeDir, configFile, includeOptional }, result);
  }
  printSummary(log, backupRoot, dryRun, result);
}

async function captureItems(
  items: BackupItem[],
  filesRoot: string,
  dryRun: boolean,
  log: Logger,
): Promise<CaptureResult> {
  const captured: CapturedItem[] = [];
  const skipped: BackupItem[] = [];
  let totalBytes = 0;
  let totalFiles = 0;

  for (const item of items) {
    if (!(await pathExists(item.source))) {
      skipped.push(item);
      log(`  skip  ${item.label}  (not found)`);
      continue;
    }
    const size = await measureSize(item.source);
    if (!dryRun) await copyInto(item.source, join(filesRoot, item.dest));
    totalBytes += size.bytes;
    totalFiles += size.files;
    captured.push({ ...item, ...size });
    log(
      `  ${dryRun ? "plan" : "copy"}  ${item.label}  ${formatBytes(size.bytes)} (${plural(size.files, "file")})`,
    );
  }
  return { captured, skipped, totalBytes, totalFiles };
}

function printSummary(
  log: Logger,
  backupRoot: string,
  dryRun: boolean,
  result: CaptureResult,
): void {
  log("");
  const verb = dryRun ? "would back up" : "backed up";
  const items = plural(result.captured.length, "item");
  log(
    `${verb} ${items}: ${formatBytes(result.totalBytes)} across ${plural(result.totalFiles, "file")}`,
  );
  if (!dryRun) log(`saved to ${backupRoot}`);
  if (result.captured.some((item) => item.dest === ".claude.json")) {
    log("");
    log(
      "note: .claude.json holds account and credential data. keep this backup private and do not commit it unencrypted.",
    );
  }
}

async function writeManifest(
  backupRoot: string,
  meta: ManifestMeta,
  result: CaptureResult,
): Promise<void> {
  const manifest = {
    tool: "claude-code-backup",
    version: VERSION,
    createdAt: new Date().toISOString(),
    timestamp: meta.stamp,
    includeOptional: meta.includeOptional,
    sources: { claudeDir: meta.claudeDir, configFile: meta.configFile },
    totals: { bytes: result.totalBytes, files: result.totalFiles },
    items: result.captured.map((item) => ({
      label: item.label,
      tier: item.tier,
      source: item.source,
      dest: `files/${item.dest}`,
      bytes: item.bytes,
      files: item.files,
    })),
    skipped: result.skipped.map((item) => ({ label: item.label, source: item.source })),
  };
  await mkdir(backupRoot, { recursive: true });
  await writeFile(join(backupRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
