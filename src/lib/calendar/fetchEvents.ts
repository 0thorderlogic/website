import type { CalendarEvent, RawGoogleCalendarEvent, RawGoogleCalendarResponse } from "./types";

interface CalendarWindow {
  timeMin: string;
  timeMax: string;
}

function getCalendarQueryWindow(anchorDate = new Date()): CalendarWindow {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  return {
    timeMin: new Date(year, month - 6, 1).toISOString(),
    timeMax: new Date(year, month + 7, 0).toISOString(),
  };
}

function normalizeCalendarEvent(
  event: RawGoogleCalendarEvent,
  index: number,
): CalendarEvent | null {
  const start = event.start?.dateTime ?? event.start?.date;
  if (!start) return null;

  const end = event.end?.dateTime ?? event.end?.date ?? null;
  const title = event.summary?.trim() || "Untitled";
  const attendeesCount = Array.isArray(event.attendees) ? event.attendees.length : 0;

  return {
    id: event.id || `event-${index}`,
    title,
    start,
    end,
    isAllDay: !event.start?.dateTime,
    link: event.htmlLink || "https://calendar.google.com",
    location: event.location?.trim() || null,
    description: event.description?.trim() || null,
    hangoutLink: event.hangoutLink?.trim() || null,
    attendeesCount,
  };
}

export async function fetchCalendarEvents(
  apiKey: string,
  calendarId: string,
): Promise<CalendarEvent[]> {
  const queryWindow = getCalendarQueryWindow();
  const params = new URLSearchParams({
    key: apiKey,
    timeMin: queryWindow.timeMin,
    timeMax: queryWindow.timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch calendar events: ${response.statusText}`);
  }

  const payload = (await response.json()) as RawGoogleCalendarResponse;
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  return rawItems
    .map((event, index) => normalizeCalendarEvent(event, index))
    .filter((event): event is CalendarEvent => Boolean(event));
}
