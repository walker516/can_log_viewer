import { useCallback, useMemo, useRef } from "react";
import { Topbar } from "./components/Topbar";
import { SignalSidebar } from "./components/SignalSidebar";
import { Timeline } from "./components/Timeline";
import { useStatus } from "./hooks/useStatus";
import { useLogSession } from "./hooks/useLogSession";
import { useSignalSelection } from "./hooks/useSignalSelection";
import { useSignalQuery } from "./hooks/useSignalQuery";
import { useTimelineView } from "./hooks/useTimelineView";
import { useTimelineExport } from "./hooks/useTimelineExport";
import { useRecentSignals } from "./hooks/useRecentSignals";
import { formatWarningSummary } from "./lib/warnings";

// App is a thin composition layer: it wires the feature hooks together and lays
// out the three panels. All real logic lives in hooks/ and lib/.
function App() {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const report = useStatus("Open a CAN log file.");

  const session = useLogSession(report);
  const onSelectionLimit = useCallback(() => report.setStatus("Up to 5 signals can be displayed."), [report]);
  const selection = useSignalSelection(session.cachePath, onSelectionLimit);
  const recent = useRecentSignals();
  const view = useTimelineView(session.fullRange, timelineRef);

  const query = useSignalQuery({
    cachePath: session.cachePath,
    selectedSignals: selection.selectedSignals,
    start: view.start,
    end: view.end,
    report
  });

  const canExport = selection.selectedSignals.length > 0 && Boolean(query) && !report.loading;
  const exportPng = useTimelineExport({ timelineRef, logFileName: session.logFileName, canExport, report });

  const signalByName = useMemo(
    () => new Map((session.inspect?.signals ?? []).map((signal) => [signal.signal_name, signal])),
    [session.inspect]
  );

  // Decode-warning summary comes from the inspect result (by_code counts) and
  // stays tied to the opened log, independent of transient query status.
  const warningSummary = useMemo(() => formatWarningSummary(session.inspect?.warnings), [session.inspect]);

  return (
    <main className="app-shell">
      <Topbar
        logFileName={session.logFileName}
        status={report.status}
        loading={report.loading}
        canExport={canExport}
        canFitAll={Boolean(session.inspect)}
        warningSummary={warningSummary}
        onOpenLog={session.openLog}
        onFitAll={view.fitAll}
        onExport={exportPng}
      />
      <section className="workspace">
        <SignalSidebar signals={session.inspect?.signals ?? []} selection={selection} recent={recent} />
        <Timeline
          timelineRef={timelineRef}
          view={view}
          selection={selection}
          signalByName={signalByName}
          query={query}
        />
      </section>
    </main>
  );
}

export default App;
