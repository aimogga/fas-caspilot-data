export type DashboardCard = {
  id: string;
  title: string;
  metricName: string;
};

export const METRIC_CARDS: readonly DashboardCard[] = [
  { id: "m1", title: "Days from court order to first session", metricName: "M1" },
  { id: "m2", title: "Days from application to funding decision", metricName: "M2" },
  { id: "m3", title: "Approved but never started", metricName: "M3" },
  { id: "m5", title: "Cost per completed episode", metricName: "M5" },
  { id: "m6", title: "Where therapy dollars went", metricName: "M6" },
  { id: "o1", title: "Outcome change", metricName: "O1" },
];

export const M4_COLUMNS = ["Income band", "Completed", "Closed", "Rate"] as const;

export const NOT_AVAILABLE = "Not available yet";

export function notAvailableNote(metricName: string): string {
  return `This number appears when ${metricName} is set up.`;
}
