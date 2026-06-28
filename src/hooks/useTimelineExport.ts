import { useCallback, useState } from "react";
import type { RefObject } from "react";
import { exportTimelinePng } from "../backend";
import { renderTimelinePng } from "../lib/pngExport";
import { baseName, errorMessage } from "../lib/strings";
import type { StatusReporter } from "./useStatus";

export interface ExportParams {
  timelineRef: RefObject<HTMLDivElement | null>;
  sourceLogPath: string;
  canExport: boolean;
  report: StatusReporter;
}

export interface TimelineExport {
  exportPng: () => Promise<void>;
  lastExportPath: string;
}

// Exports only the timeline area as PNG (sidebar/topbar/tooltips excluded by the
// renderer). No save dialog: Tauri writes into the app-managed
// exports/png directory and returns the absolute saved path. Status remains
// filename-only; the full path is kept for future copy/open actions.
export function useTimelineExport({ timelineRef, sourceLogPath, canExport, report }: ExportParams): TimelineExport {
  const { setStatus, setLoading } = report;
  const [lastExportPath, setLastExportPath] = useState("");

  const exportPng = useCallback(async () => {
    if (!timelineRef.current || !canExport || !sourceLogPath) {
      return;
    }
    setLoading(true);
    setStatus("Exporting PNG...");
    try {
      const bytes = await renderTimelinePng(timelineRef.current);
      const result = await exportTimelinePng(sourceLogPath, Array.from(bytes));
      setLastExportPath(result.saved_path);
      setStatus(`Exported ${baseName(result.saved_path)}`);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [timelineRef, sourceLogPath, canExport, setStatus, setLoading]);

  return { exportPng, lastExportPath };
}
