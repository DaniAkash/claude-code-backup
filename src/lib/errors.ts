export class BackupError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "BackupError";
    this.code = code;
  }
}
