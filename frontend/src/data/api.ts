// Single data-access surface. Components import only from this file.
// Swap the bodies for fetch() calls when the backend lands; types stay.
import { DORMS, getMachines, getMockObservations } from "./mock";
import { averageByWeekday, averageByWeekdayHalfHour } from "./averages";
import type {
  AveragedUsage,
  DashboardSnapshot,
  Dorm,
  DormId,
  UsageObservation,
} from "./types";

export function listDorms(): Dorm[] {
  return DORMS;
}

// Route preserved for the backend. Today this returns mock observations;
// when the backend lands, swap the body for `fetch(`/observations?dorm=${id}`)`
// and keep the return shape. Everything downstream — averages, components —
// stays untouched.
export function fetchObservations(
  dormId: DormId,
  refreshKey = 0
): UsageObservation[] {
  return getMockObservations(dormId, refreshKey);
}

export function getAveragedSeries(
  dormId: DormId,
  refreshKey = 0
): AveragedUsage {
  const observations = fetchObservations(dormId, refreshKey);
  return {
    dormId,
    weekdayDaily: averageByWeekday(observations),
    weekdayHalfHour: averageByWeekdayHalfHour(observations),
  };
}

export function getDashboard(dormId: DormId, refreshKey = 0): DashboardSnapshot {
  return {
    dorm: DORMS.find((d) => d.id === dormId) ?? DORMS[0],
    dorms: DORMS,
    machines: getMachines(dormId, refreshKey),
    usage: getAveragedSeries(dormId, refreshKey),
    generatedAt: new Date().toISOString(),
  };
}
