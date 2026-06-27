import { useCallback } from "react";
import type { RefObject } from "react";
import { exportTimelinePng } from "../backend";
import { renderTimelinePng } from "../lib/pngExport";
import { errorMessage } from "../lib/strings";
import type { StatusReporter } from "./useStatus";

export interface ExportParams {
  timelineRef: RefObject<HTMLDivElement | null>;
  logFileName: string;
  canExport: boolean;
  report: StatusReporter;
}

// Exports only the timeline area as PNG (sidebar/topbar/tooltips excluded by the
// renderer). No save dialog: the backend writes into the app-managed
// exports/png directory and returns the saved file name for a short status.
export function useTimelineExport({ timelineRef, logFileName, canExport, report }: ExportParams): () => Promise<void> {
  const { setStatus, setLoading } = report;

  return useCallback(async () => {
    if (!timelineRef.current || !canExport) {
      return;
    }
    setLoading(true);
    setStatus("Exporting PNG...");
    try {
      const bytes = await renderTimelinePng(timelineRef.current);
      const fileName = await exportTimelinePng(logFileName, Array.from(bytes));
      setStatus(`Exported ${fileName}`);
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [timelineRef, logFileName, canExport, setStatus, setLoading]);
}
