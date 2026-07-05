import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface SizeResult {
  bytes: number;
  files: number;
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function measureSize(target: string): Promise<SizeResult> {
  const info = await stat(target);
  if (!info.isDirectory()) return { bytes: info.size, files: 1 };

  let bytes = 0;
  let files = 0;
  const entries = await readdir(target, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(target, entry.name);
    if (entry.isDirectory()) {
      const sub = await measureSize(child);
      bytes += sub.bytes;
      files += sub.files;
    } else if (entry.isFile()) {
      const fileInfo = await stat(child);
      bytes += fileInfo.size;
      files += 1;
    }
  }
  return { bytes, files };
}

export async function copyInto(source: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await cp(source, dest, { recursive: true });
}
