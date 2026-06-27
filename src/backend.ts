import { invoke } from "@tauri-apps/api/core";
import type { InspectResponse, QueryResponse } from "./types";

export async function decodeLog(logPath: string): Promise<InspectResponse> {
  return invoke<InspectResponse>("decode_log", { logPath });
}

export async function inspectCache(cachePath: string): Promise<InspectResponse> {
  return invoke<InspectResponse>("inspect_cache", { cachePath });
}

export async function queryCache(
  cachePath: string,
  signals: string[],
  start: number,
  end: number,
  maxPointsPerSignal = 5000
): Promise<QueryResponse> {
  return invoke<QueryResponse>("query_cache", {
    cachePath,
    signals,
    start,
    end,
    maxPointsPerSignal
  });
}

// Exports a rendered timeline PNG into the app-managed exports/png directory.
// The backend owns the destination and file name; returns the saved file name.
export async function exportTimelinePng(logFileName: string, bytes: number[]): Promise<string> {
  return invoke<string>("export_timeline_png", { logFileName, bytes });
}
