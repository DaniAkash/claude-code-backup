# claude-code-backup

Snapshot your Claude Code history and configuration into a timestamped backup directory. One command captures the data that actually matters: your conversation transcripts, prompt history, settings, and global config. Regenerable caches are left out.

## What it backs up

**Core (always):**

- `~/.claude.json` - global config, connected accounts, per-project settings
- `~/.claude/settings.json` - permissions, hooks, env vars, model preferences
- `~/.claude/history.jsonl` - your prompt input history
- `~/.claude/projects/` - every conversation transcript, foldered by project

**Optional (`--optional`):**

- `~/.claude/backups/` - the rolling `.claude.json` backups Claude Code keeps
- `~/.claude/CLAUDE.md` - your global memory file, if present

Caches and ephemeral state (file-history, image-cache, paste-cache, shell-snapshots, session-env, sessions, telemetry) are intentionally excluded. They regenerate on their own and dominate disk usage.

## Install

```sh
bun install
bun run build
```

Or run it once without installing globally:

```sh
bunx claude-code-backup ~/backups/claude
```

## Usage

```sh
claude-code-backup <target-directory> [options]
```

Each run writes to `<target-directory>/<YYYY-MM-DD-HHmm>/files`, mirroring your home layout so a restore is a plain copy back:

```
<target-directory>/
  2026-07-05-0844/
    manifest.json
    files/
      .claude.json
      .claude/
        settings.json
        history.jsonl
        projects/
```

### Options

| Option                 | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `--optional`           | also include the optional tier (config backups, global `CLAUDE.md`) |
| `--claude-dir <path>`  | Claude Code data directory (default `~/.claude`)                    |
| `--config-file <path>` | global `.claude.json` path (default `~/.claude.json`)               |
| `--dry-run`            | print what would be copied without writing anything                 |
| `--quiet`              | print only the final summary                                        |

### Examples

```sh
# Core backup
claude-code-backup ~/backups/claude

# Everything, including the optional tier
claude-code-backup ~/backups/claude --optional

# See the plan without copying 1 GB of transcripts
claude-code-backup ~/backups/claude --dry-run
```

## Restore

Copy the captured tree back into place:

```sh
cp -R <target-directory>/<stamp>/files/.claude.json ~/.claude.json
cp -R <target-directory>/<stamp>/files/.claude/. ~/.claude/
```

Transcripts are keyed by absolute project path (slashes become dashes in the folder name), so `/resume` finds old sessions only when the paths match on the restore machine. The `.jsonl` content is readable regardless.

## Security

`.claude.json` contains your connected account and can contain credentials. Treat every backup as sensitive: keep it private and never commit it unencrypted. This repository's `.gitignore` excludes local backup output for that reason.

## License

MIT
