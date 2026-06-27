// Product rule: at most five signals can be stacked at once.
export const MAX_DISPLAY_SIGNALS = 5;

// Backend downsample cap requested per signal for a visible range query.
export const MAX_QUERY_POINTS_PER_SIGNAL = 5000;

// Debounce range/selection changes before hitting the backend query.
export const QUERY_DEBOUNCE_MS = 180;

// Timeline body layout (px) used to divide remaining height across lanes.
export const TIME_AXIS_HEIGHT = 32;
export const LANE_GAP = 6;
export const TIMELINE_VERTICAL_PADDING = 28;
