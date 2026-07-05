import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/index.ts";
import { formatBytes } from "../src/lib/format.ts";
import { backupTimestamp } from "../src/lib/paths.ts";

let work: string;

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), "ccb-"));
});

afterEach(async () => {
  await rm(work, { recursive: true, force: true });
});

async function seedClaude(): Promise<{ claudeDir: string; configFile: string }> {
  const claudeDir = join(work, ".claude");
  const projects = join(claudeDir, "projects", "-Users-x-repo");
  await mkdir(projects, { recursive: true });
  await writeFile(join(projects, "session.jsonl"), '{"type":"user"}\n');
  await writeFile(join(claudeDir, "settings.json"), '{"model":"opus"}\n');
  await writeFile(join(claudeDir, "history.jsonl"), '{"display":"hi"}\n');
  await mkdir(join(claudeDir, "backups"), { recursive: true });
  await writeFile(join(claudeDir, "backups", "snap.json"), "{}\n");
  const configFile = join(work, ".claude.json");
  await writeFile(configFile, '{"oauthAccount":{}}\n');
  return { claudeDir, configFile };
}

function runArgs(
  target: string,
  claudeDir: string,
  configFile: string,
  extra: string[] = [],
): string[] {
  return [
    "node",
    "cli",
    target,
    "--claude-dir",
    claudeDir,
    "--config-file",
    configFile,
    "--quiet",
    ...extra,
  ];
}

test("backupTimestamp matches YYYY-MM-DD-HHmm", () => {
  expect(backupTimestamp(new Date(2026, 6, 5, 8, 44))).toBe("2026-07-05-0844");
  expect(backupTimestamp(new Date(2026, 0, 9, 3, 7))).toBe("2026-01-09-0307");
});

test("formatBytes renders human sizes", () => {
  expect(formatBytes(512)).toBe("512 B");
  expect(formatBytes(1536)).toBe("1.5 KB");
  expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
});

test("backs up core tier and mirrors the home layout", async () => {
  const { claudeDir, configFile } = await seedClaude();
  const target = join(work, "out");

  const code = await main(runArgs(target, claudeDir, configFile));
  expect(code).toBe(0);

  const stamps = await readdir(target);
  expect(stamps).toHaveLength(1);
  const filesRoot = join(target, stamps[0]!, "files");

  expect(await readFile(join(filesRoot, ".claude.json"), "utf8")).toContain("oauthAccount");
  expect(await readFile(join(filesRoot, ".claude", "settings.json"), "utf8")).toContain("opus");
  const transcript = join(filesRoot, ".claude", "projects", "-Users-x-repo", "session.jsonl");
  expect(await readFile(transcript, "utf8")).toContain("user");

  const manifest = JSON.parse(await readFile(join(target, stamps[0]!, "manifest.json"), "utf8"));
  expect(manifest.includeOptional).toBe(false);
  const labels = manifest.items.map((item: { label: string }) => item.label);
  expect(labels).toContain("conversation transcripts");
  expect(labels).not.toContain("config backups");
});

test("--optional pulls in the optional tier", async () => {
  const { claudeDir, configFile } = await seedClaude();
  const target = join(work, "out");

  await main(runArgs(target, claudeDir, configFile, ["--optional"]));
  const stamps = await readdir(target);
  const backups = join(target, stamps[0]!, "files", ".claude", "backups", "snap.json");
  expect(await readFile(backups, "utf8")).toBe("{}\n");
});

test("--dry-run writes nothing", async () => {
  const { claudeDir, configFile } = await seedClaude();
  const target = join(work, "out");

  const code = await main(runArgs(target, claudeDir, configFile, ["--dry-run"]));
  expect(code).toBe(0);

  let wrote = true;
  try {
    await readdir(target);
  } catch {
    wrote = false;
  }
  expect(wrote).toBe(false);
});

test("missing sources are skipped, not fatal", async () => {
  const claudeDir = join(work, "empty-claude");
  await mkdir(claudeDir, { recursive: true });
  await writeFile(join(claudeDir, "history.jsonl"), "{}\n");
  const configFile = join(work, "missing.json");
  const target = join(work, "out");

  const code = await main(runArgs(target, claudeDir, configFile));
  expect(code).toBe(0);
  const stamps = await readdir(target);
  const history = join(target, stamps[0]!, "files", ".claude", "history.jsonl");
  expect(await readFile(history, "utf8")).toBe("{}\n");
});
