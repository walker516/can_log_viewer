import { useState } from "react";

export interface StatusReporter {
  status: string;
  loading: boolean;
  // The setters come straight from useState, so they are referentially stable
  // and safe to use as effect dependencies in the hooks that consume them.
  setStatus: (message: string) => void;
  setLoading: (value: boolean) => void;
}

export function useStatus(initial: string): StatusReporter {
  const [status, setStatus] = useState(initial);
  const [loading, setLoading] = useState(false);
  return { status, loading, setStatus, setLoading };
}
