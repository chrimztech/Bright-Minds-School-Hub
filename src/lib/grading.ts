export type GradeBand = { min: number; max: number; grade: string; label: string };

export const DEFAULT_BANDS: GradeBand[] = [
  { min: 90, max: 100, grade: "A", label: "Excellent" },
  { min: 75, max: 89, grade: "B", label: "Very Good" },
  { min: 60, max: 74, grade: "C", label: "Good" },
  { min: 50, max: 59, grade: "D", label: "Pass" },
  { min: 0, max: 49, grade: "E", label: "Needs Improvement" },
];

export function gradeFor(percent: number, bands: GradeBand[] = DEFAULT_BANDS) {
  return bands.find((b) => percent >= b.min && percent <= b.max) ?? bands[bands.length - 1];
}