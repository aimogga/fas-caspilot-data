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
  { id: "m4", title: "Completion rate by income band", metricName: "M4" },
  { id: "m6", title: "Where therapy dollars went", metricName: "M6" },
  { id: "o1", title: "Outcome change", metricName: "O1" },
];

export const M4_COLUMNS = ["Income band", "Completed", "Closed", "Rate"] as const;
export const M6_COLUMNS = ["Provider group", "Avg rate per hour", "Dollars", "Episodes"] as const;
export const O1_COLUMNS = ["Measure", "Mean change", "Share improved", "n"] as const;
export const GROUP_LABELS: Record<string, string> = { affiliated: "Affiliated providers", other: "Other providers" };

export const NOT_AVAILABLE = "Not available yet";
/** `Data as of Jul 2026`, or `Data date not available yet` when no row carries a date (never "as of Not available yet"). */
export const asOfLabel = (asOf: string): string => (asOf === NOT_AVAILABLE ? "Data date not available yet" : `Data as of ${asOf}`);
/** Footer fragment: `as of Jul 2026`, or `date not available yet`. */
export const asOfNote = (asOf: string): string => (asOf === NOT_AVAILABLE ? "date not available yet" : `as of ${asOf}`);

export function notAvailableNote(metricName: string): string {
  return `This number appears when ${metricName} is set up.`;
}
