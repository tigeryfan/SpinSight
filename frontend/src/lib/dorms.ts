export const dorms = ['Alamo', 'Appleby', 'Jameson', 'Jones', 'North Hutch', 'South Hutch', 'Upper Dorms'];

const assignments = [
  { dorm: 'Upper Dorms', numbers: [8, 9, 10, 11, 12] },
  { dorm: 'South Hutch', numbers: [1, 2] },
  { dorm: 'North Hutch', numbers: [3, 4] },
];

export function isUnassignedDorm(dorm: string): boolean {
  return dorms.includes(dorm) && !assignments.some(group => group.dorm === dorm);
}

export function machineDorm(machineName: string | null, _locationName: string | null): string {
  const match = machineName?.match(/^[WD]([1-9]\d*)$/);
  const assignment = match && assignments.find(group => group.numbers.includes(Number(match[1])));
  return assignment?.dorm || 'Unassigned';
}
