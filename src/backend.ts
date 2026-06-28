import { invoke } from "@tauri-apps/api/core";
import type { ExportTimelinePngResponse, InspectResponse, QueryResponse } from "./types";

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
// The Tauri layer owns the destination and file name and returns the absolute
// saved path for internal follow-up actions.
export async function exportTimelinePng(sourceLogPath: string, bytes: number[]): Promise<ExportTimelinePngResponse> {
  return invoke<ExportTimelinePngResponse>("export_timeline_png", { sourceLogPath, bytes });
}
