import type { Tank } from "./simulation";
export function damageState(
  t: Tank,
): "intact" | "smoking" | "burning" | "wreck" {
  if (!t.alive) return "wreck";
  const max = t.maxHp ?? (t.id === 0 ? 100 : t.id === 3 ? 95 : 82);
  if (t.hp / max <= 0.35) return "burning";
  if (t.hp / max <= 0.7) return "smoking";
  return "intact";
}
