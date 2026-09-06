// Single data-access surface. Components import only from this file.
// Swap the bodies for fetch() calls when the backend lands; types stay.
import { DORMS } from "./mock";
import { getMachines, getUsage } from "./mock";
import type { DashboardSnapshot, Dorm, DormId } from "./types";

export function listDorms(): Dorm[] {
  return DORMS;
}

export function getDashboard(dormId: DormId, refreshKey = 0): DashboardSnapshot {
  return {
    dorm: DORMS.find((d) => d.id === dormId) ?? DORMS[0],
    dorms: DORMS,
    machines: getMachines(dormId, refreshKey),
    usage: getUsage(dormId, refreshKey),
    generatedAt: new Date().toISOString(),
  };
}
