import { useCallback } from "react";
import type { RefObject } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { savePng } from "../backend";
import { renderTimelinePng } from "../lib/pngExport";
import { ensurePngExtension, errorMessage, exportFileName } from "../lib/strings";
import type { StatusReporter } from "./useStatus";

export interface ExportParams {
  timelineRef: RefObject<HTMLDivElement | null>;
  logFileName: string;
  canExport: boolean;
  report: StatusReporter;
}

// Exports only the timeline area as PNG (sidebar/topbar excluded by design).
export function useTimelineExport({ timelineRef, logFileName, canExport, report }: ExportParams): () => Promise<void> {
  const { setStatus, setLoading } = report;

  return useCallback(async () => {
    if (!timelineRef.current || !canExport) {
      return;
    }
    const selected = await save({
      title: "Export timeline PNG",
      defaultPath: exportFileName(logFileName),
      filters: [{ name: "PNG image", extensions: ["png"] }]
    });
    if (!selected) {
      return;
    }
    setLoading(true);
    setStatus("Exporting PNG...");
    try {
      const bytes = await renderTimelinePng(timelineRef.current);
      await savePng(ensurePngExtension(selected), Array.from(bytes));
      setStatus("PNG exported.");
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [timelineRef, logFileName, canExport, setStatus, setLoading]);
}
