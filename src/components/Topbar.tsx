import "./Topbar.css";

interface TopbarProps {
  logFileName: string;
  status: string;
  loading: boolean;
  canExport: boolean;
  canFitAll: boolean;
  warningSummary: string;
  onOpenLog: () => void;
  onFitAll: () => void;
  onExport: () => void;
}

// Top bar: Open Log on the left, then the opened file name, a discreet decode
// warning count, and the status line. Fit All and Export are compact icon
// buttons on the right (icon-only by policy, labelled via title/aria-label).
export function Topbar({
  logFileName,
  status,
  loading,
  canExport,
  canFitAll,
  warningSummary,
  onOpenLog,
  onFitAll,
  onExport
}: TopbarProps) {
  return (
    <header className="topbar">
      <button className="primary-action" type="button" onClick={onOpenLog} disabled={loading}>
        Open Log
      </button>
      <div className="open-file-name" title={logFileName}>
        {logFileName}
      </div>
      {/* Always rendered so the column layout stays stable; empty when there are
          no warnings. */}
      <div className="warning-summary" title={warningSummary}>
        {warningSummary}
      </div>
      <div className="status">{status}</div>
      <div className="topbar-actions">
        <button
          className="icon-action"
          type="button"
          onClick={onFitAll}
          disabled={!canFitAll}
          title="Fit All"
          aria-label="Fit All"
        >
          <FitAllIcon />
        </button>
        <button
          className="icon-action"
          type="button"
          onClick={onExport}
          disabled={!canExport}
          title="Export PNG"
          aria-label="Export PNG"
        >
          <ExportIcon />
        </button>
      </div>
    </header>
  );
}

function FitAllIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 4v8M14 4v8M5 8h6M5 8l2-2M5 8l2 2M11 8l-2-2M11 8l-2 2" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
    </svg>
  );
}
