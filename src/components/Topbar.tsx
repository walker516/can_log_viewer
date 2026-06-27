import "./Topbar.css";

interface TopbarProps {
  logFileName: string;
  status: string;
  loading: boolean;
  canExport: boolean;
  onOpenLog: () => void;
  onExport: () => void;
}

// Top bar keeps only the two primary actions (Open, Export) plus the opened
// file name and a status line. By policy it shows no path, counts, or range.
export function Topbar({ logFileName, status, loading, canExport, onOpenLog, onExport }: TopbarProps) {
  return (
    <header className="topbar">
      <button className="primary-action" type="button" onClick={onOpenLog} disabled={loading}>
        Open Log
      </button>
      <button className="secondary-action" type="button" onClick={onExport} disabled={!canExport}>
        Export
      </button>
      <div className="open-file-name" title={logFileName}>
        {logFileName}
      </div>
      <div className="status">{status}</div>
    </header>
  );
}
