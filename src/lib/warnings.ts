// Build a short decode-warning summary for display near the status line.
// Returns "" when there is nothing to report so the UI stays quiet.
//
// The input is the `by_code` count map from the backend inspect result; we
// intentionally never surface raw warning rows, files, or paths here.
const MAX_CODES_INLINE = 3;
const MAX_SUMMARY_LENGTH = 60;

export function formatWarningSummary(warnings: Record<string, number> | undefined): string {
  if (!warnings) {
    return "";
  }
  const entries = Object.entries(warnings).filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) {
    return "";
  }

  // Include the per-code breakdown only when it stays short; otherwise the count
  // alone keeps the bar uncluttered.
  const breakdown = entries
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `${code}: ${count}`)
    .join(", ");
  const detailed = `Warnings: ${total} (${breakdown})`;
  if (entries.length <= MAX_CODES_INLINE && detailed.length <= MAX_SUMMARY_LENGTH) {
    return detailed;
  }
  return `Warnings: ${total}`;
}
