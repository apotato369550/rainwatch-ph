export const number = (value: number | null, digits = 1) =>
  value === null ? "—" : value.toFixed(digits);
export const time = (unix: number) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(unix * 1000);
export const dateTime = (unix: number) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(unix * 1000);
export const severityColors = {
  Low: "#187968",
  Moderate: "#5E751D",
  Elevated: "#986000",
  High: "#B14C1E",
  Extreme: "#A62C49",
};
