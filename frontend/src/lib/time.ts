export const DAY_ABBR = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export function dayIndexFromIsoDate(iso: string): number {
  const d = new Date(`${iso}T00:00:00`);
  // JS getDay: 0=Sun..6=Sat. We want Mon=0..Sun=6
  return (d.getDay() + 6) % 7;
}

export function dayAbbr(iso: string): string {
  return DAY_ABBR[dayIndexFromIsoDate(iso)];
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  return `${month} ${day}`;
}

export function weekRange(startIso: string, endIso: string): string {
  return `${shortDate(startIso)} — ${shortDate(endIso)}`;
}

export function fmtHourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}

export function fmtEta(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
