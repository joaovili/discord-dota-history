export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function describeOpenDotaFailure(errors: string[]): string {
  const codes = [
    ...new Set(
      errors
        .map((message) => /OpenDota request failed: (\d{3})/.exec(message)?.[1])
        .filter((code): code is string => Boolean(code)),
    ),
  ];
  const detail = codes.length > 0 ? ` (HTTP ${codes.join(", ")})` : "";
  return `🍝 A OpenDota tirou uma soneca no meio do expediente${detail}.`;
}
