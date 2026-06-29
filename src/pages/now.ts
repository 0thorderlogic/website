import type { APIRoute } from "astro";
import { addDays, format, startOfDay } from "date-fns";
import { fetchCalendarEvents } from "../lib/calendar/fetchEvents";
import type { CalendarEvent } from "../lib/calendar/types";

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), "HH:mm");
  } catch {
    return iso;
  }
}

function eventLine(event: CalendarEvent): string {
  if (event.isAllDay) return `  • [all day]  ${event.title}`;
  const time = event.end
    ? `${formatTime(event.start)}–${formatTime(event.end)}`
    : formatTime(event.start);
  const extras: string[] = [];
  if (event.location) extras.push(`@ ${event.location}`);
  if (event.hangoutLink) extras.push("[Meet]");
  return `  • ${time}  ${event.title}${extras.length ? "  " + extras.join(" ") : ""}`;
}

function byDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = e.start.slice(0, 10);
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  return map;
}

export const GET: APIRoute = async () => {
  const apiKey = import.meta.env.GOOGLE_API_KEY ?? "";
  const calendarId = import.meta.env.GOOGLE_CALENDAR_ID ?? "";
  const now = new Date();

  const out: string[] = [];

  out.push("Sanket's schedule — a115.xyz/now");
  out.push(`Built: ${now.toISOString()}`);
  out.push("Calendar: https://a115.xyz/calendar");
  out.push("");
  out.push('This file lets you ask questions like "what is Sanket up to today?".');
  out.push("The events below were fetched at build time.");
  out.push("For live/fresh data fetch the API URL at the bottom of this file.");
  out.push("");
  out.push("=".repeat(60));

  if (!apiKey || !calendarId) {
    out.push("");
    out.push("(calendar credentials not configured)");
  } else {
    let events: CalendarEvent[] = [];
    try {
      events = await fetchCalendarEvents(apiKey, calendarId);
    } catch {
      out.push("");
      out.push("(failed to fetch events at build time)");
    }

    const days = byDay(events);
    const today = startOfDay(now);

    // TODAY
    const todayKey = format(today, "yyyy-MM-dd");
    const todayEvents = days.get(todayKey) ?? [];
    out.push("");
    out.push(`TODAY — ${format(today, "EEEE, d MMMM yyyy")}`);
    if (todayEvents.length === 0) out.push("  (no events)");
    else todayEvents.forEach((e) => out.push(eventLine(e)));

    // TOMORROW
    const tomorrow = addDays(today, 1);
    const tomorrowKey = format(tomorrow, "yyyy-MM-dd");
    const tomorrowEvents = days.get(tomorrowKey) ?? [];
    out.push("");
    out.push(`TOMORROW — ${format(tomorrow, "EEEE, d MMMM")}`);
    if (tomorrowEvents.length === 0) out.push("  (no events)");
    else tomorrowEvents.forEach((e) => out.push(eventLine(e)));

    // NEXT 14 DAYS
    out.push("");
    out.push("NEXT 14 DAYS");
    let hasUpcoming = false;
    for (let i = 2; i <= 14; i++) {
      const d = addDays(today, i);
      const key = format(d, "yyyy-MM-dd");
      const evs = days.get(key);
      if (evs && evs.length > 0) {
        hasUpcoming = true;
        out.push(`  ${format(d, "EEE d MMM")}`);
        evs.forEach((e) => out.push(`  ${eventLine(e).trimStart()}`));
      }
    }
    if (!hasUpcoming) out.push("  (nothing scheduled in the next 14 days)");

    // LIVE API URL
    out.push("");
    out.push("=".repeat(60));
    out.push("");
    out.push("LIVE DATA — fetch this URL for up-to-the-minute events:");
    const tMin = encodeURIComponent(startOfDay(now).toISOString());
    const tMax = encodeURIComponent(addDays(now, 30).toISOString());
    out.push(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
        `?key=${apiKey}&singleEvents=true&orderBy=startTime` +
        `&timeMin=${tMin}&timeMax=${tMax}&maxResults=100`,
    );
  }

  return new Response(out.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
