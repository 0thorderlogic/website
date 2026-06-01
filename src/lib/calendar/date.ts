import { format, isValid, parseISO } from "date-fns";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function resolveBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

let activeTimezone: string = resolveBrowserTimezone();

export function setActiveTimezone(tz: string): void {
  activeTimezone = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

export function getActiveTimezone(): string {
  return activeTimezone;
}

export function safeParseIsoDate(isoDate: string): Date | null {
  const parsed = parseISO(isoDate);
  return isValid(parsed) ? parsed : null;
}

export function formatMonthYear(date: Date): string {
  return format(date, "MMMM yyyy");
}

export function formatDayNumber(date: Date): string {
  return format(date, "d");
}

export function formatReadableDay(date: Date): string {
  return format(date, "EEEE, MMMM do yyyy");
}

export function formatTimeFromIso(isoDate: string): string {
  const parsed = safeParseIsoDate(isoDate);
  if (!parsed) return "";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: activeTimezone,
  }).format(parsed);
}

export function dayKeyFromDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function dayKeyFromIso(isoDate: string): string | null {
  const parsed = safeParseIsoDate(isoDate);
  if (!parsed) return null;

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: activeTimezone,
  }).format(parsed);
}
