export type ViewMode = "overhead" | "shoulder" | "interior";
export const VIEW_LABELS: Record<ViewMode, string> = {
  overhead: "俯视",
  shoulder: "过肩",
  interior: "车内",
};
export function nextView(mode: ViewMode): ViewMode {
  return mode === "overhead"
    ? "shoulder"
    : mode === "shoulder"
      ? "interior"
      : "overhead";
}
export function showEnemyPositions(mode: ViewMode) {
  return mode !== "interior";
}
/** Rate control: keep the mouse in the central dead zone to stop traversing. */
export function interiorAim(current: number, mouseX: number, dt: number) {
  const deadZone = 0.14,
    x = Math.max(-1, Math.min(1, mouseX));
  const rate =
    Math.abs(x) <= deadZone
      ? 0
      : ((Math.sign(x) * (Math.abs(x) - deadZone)) / (1 - deadZone)) * 0.72;
  return current - rate * Math.max(0, Math.min(dt, 0.1));
}
