import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { decodeLog } from "../backend";
import type { InspectResponse } from "../types";
import { baseName, errorMessage } from "../lib/strings";
import type { StatusReporter } from "./useStatus";

export interface LogSession {
  inspect: InspectResponse | null;
  cachePath: string;
  logFileName: string;
  fullRange: [number | null, number | null];
  openLog: () => Promise<void>;
}

// Owns the opened-log lifecycle: file picker, decode, and the resulting cache
// metadata. Selection/viewport/query state react to `cachePath`/`fullRange`
// changes elsewhere, so this hook does not need to reset them directly.
export function useLogSession({ setStatus, setLoading }: StatusReporter): LogSession {
  const [inspect, setInspect] = useState<InspectResponse | null>(null);
  const [cachePath, setCachePath] = useState("");
  const [logFileName, setLogFileName] = useState("");

  const openLog = useCallback(async () => {
    const selected = await open({
      directory: false,
      multiple: false,
      title: "Open CAN log",
      filters: [{ name: "CAN logs", extensions: ["blf", "asc", "csv"] }]
    });
    if (typeof selected !== "string") {
      return;
    }
    setLoading(true);
    setStatus("Decoding log...");
    setCachePath("");
    setLogFileName(baseName(selected));
    try {
      const response = await decodeLog(selected);
      setCachePath(response.cache);
      setInspect(response);
      setStatus("Log loaded.");
    } catch (error) {
      setInspect(null);
      setCachePath("");
      setLogFileName("");
      setStatus(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [setStatus, setLoading]);

  return { inspect, cachePath, logFileName, fullRange: inspect?.time_range ?? [null, null], openLog };
}
