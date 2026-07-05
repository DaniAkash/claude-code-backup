import { join } from "node:path";

export type Tier = "core" | "optional";

export interface BackupItem {
  label: string;
  tier: Tier;
  source: string;
  dest: string;
}

export interface ManifestOptions {
  claudeDir: string;
  configFile: string;
}

export function backupItems({ claudeDir, configFile }: ManifestOptions): BackupItem[] {
  return [
    {
      label: "global config (.claude.json)",
      tier: "core",
      source: configFile,
      dest: ".claude.json",
    },
    {
      label: "settings",
      tier: "core",
      source: join(claudeDir, "settings.json"),
      dest: ".claude/settings.json",
    },
    {
      label: "prompt history",
      tier: "core",
      source: join(claudeDir, "history.jsonl"),
      dest: ".claude/history.jsonl",
    },
    {
      label: "conversation transcripts",
      tier: "core",
      source: join(claudeDir, "projects"),
      dest: ".claude/projects",
    },
    {
      label: "config backups",
      tier: "optional",
      source: join(claudeDir, "backups"),
      dest: ".claude/backups",
    },
    {
      label: "global memory (CLAUDE.md)",
      tier: "optional",
      source: join(claudeDir, "CLAUDE.md"),
      dest: ".claude/CLAUDE.md",
    },
  ];
}
