import { useEffect, useState } from "react";
import { queryCache } from "../backend";
import type { QueryResponse } from "../types";
import { MAX_QUERY_POINTS_PER_SIGNAL, QUERY_DEBOUNCE_MS } from "../lib/constants";
import { errorMessage } from "../lib/strings";
import type { StatusReporter } from "./useStatus";

export interface SignalQueryParams {
  cachePath: string;
  selectedSignals: string[];
  start: number;
  end: number;
  report: StatusReporter;
}

// Debounced backend query for the selected signals over the visible range.
// Returns null whenever there is nothing valid to show.
export function useSignalQuery({ cachePath, selectedSignals, start, end, report }: SignalQueryParams): QueryResponse | null {
  const { setStatus, setLoading } = report;
  const [query, setQuery] = useState<QueryResponse | null>(null);

  useEffect(() => {
    if (!cachePath || selectedSignals.length === 0) {
      setQuery(null);
      return;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setQuery(null);
      setStatus("Range must be numeric.");
      return;
    }
    if (start >= end) {
      setQuery(null);
      setStatus("Start must be less than End.");
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setStatus("Querying selected signals...");
      try {
        const response = await queryCache(cachePath, selectedSignals, start, end, MAX_QUERY_POINTS_PER_SIGNAL);
        if (!cancelled) {
          setQuery(response);
          const missing = response.missing_signals.length;
          setStatus(missing > 0 ? `${missing} missing signal${missing === 1 ? "" : "s"}.` : "");
        }
      } catch (error) {
        if (!cancelled) {
          setQuery(null);
          setStatus(errorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, QUERY_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [cachePath, selectedSignals, start, end, setStatus, setLoading]);

  return query;
}
