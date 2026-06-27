export function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

export function exportFileName(logFileName: string): string {
  const source = logFileName || "timeline";
  const stem = source.replace(/\.[^.]+$/, "") || "timeline";
  return `${stem}_timeline.png`;
}

export function ensurePngExtension(path: string): string {
  return path.toLowerCase().endsWith(".png") ? path : `${path}.png`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return JSON.stringify(error);
}
