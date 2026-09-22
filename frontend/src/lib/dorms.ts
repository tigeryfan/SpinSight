// Upper Dorms is confirmed by the user. The remaining groups are temporary
// assignments, kept stable across loads until the real mapping is supplied.
const assignments = [
  { dorm: 'Upper Dorms', numbers: [8, 9, 10, 11, 12] },
  { dorm: 'Alamo', numbers: [1, 2, 3] },
  { dorm: 'North Hutch', numbers: [4, 5] },
  { dorm: 'South Hutch', numbers: [6, 7] },
  { dorm: 'Appleby', numbers: [13, 14, 15] },
  { dorm: 'Jones', numbers: [16, 17, 18] },
  { dorm: 'Jameson', numbers: [19, 20, 21] },
];

export function machineDorm(machineName: string | null, locationName: string | null): string {
  const match = machineName?.match(/^[WD]([1-9]\d*)$/);
  const assignment = match && assignments.find(group => group.numbers.includes(Number(match[1])));
  return assignment?.dorm || locationName || 'Unknown location';
}
