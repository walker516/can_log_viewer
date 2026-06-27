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

export async function savePng(path: string, bytes: number[]): Promise<void> {
  return invoke("save_png", { path, bytes });
}
