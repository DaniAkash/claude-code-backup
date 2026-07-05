import { homedir } from "node:os";
import { join } from "node:path";

export function backupTimestamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}-${hour}${minute}`;
}

export function defaultClaudeDir(): string {
  return join(homedir(), ".claude");
}

export function defaultConfigFile(): string {
  return join(homedir(), ".claude.json");
}
