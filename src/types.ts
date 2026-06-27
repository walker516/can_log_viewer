export interface SignalIndexItem {
  signal_name: string;
  message_name: string;
  can_id: string;
  unit: string;
  plot_type: "line" | "step";
  value_type: "numeric" | "enum" | "bool" | string;
}

export interface InspectResponse {
  cache: string;
  meta: Record<string, unknown>;
  time_range: [number | null, number | null];
  source_files: string[];
  signal_count: number;
  signals: SignalIndexItem[];
  warnings: Record<string, number>;
}

export interface TimelinePoint {
  session_time: number;
  source_time: number;
  source_file: string;
  value: number | null;
  enum_label: string | null;
}

export interface QueryResponse {
  cache: string;
  time_range: [number, number];
  signals: Record<string, TimelinePoint[]>;
  missing_signals: string[];
}

