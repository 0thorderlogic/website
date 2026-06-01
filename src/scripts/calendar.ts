import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CALENDAR_IDS } from "../lib/calendar/constants";
import {
  dayKeyFromDate,
  dayKeyFromIso,
  formatDayNumber,
  formatMonthYear,
  formatReadableDay,
  formatTimeFromIso,
  getActiveTimezone,
  setActiveTimezone,
  safeParseIsoDate,
} from "../lib/calendar/date";
import type { CalendarEvent } from "../lib/calendar/types";

interface CalendarDomRefs {
  container: HTMLElement;
  prevMonthButton: HTMLButtonElement;
  nextMonthButton: HTMLButtonElement;
  monthHeader: HTMLElement;
  timezoneSelect: HTMLSelectElement;
  grid: HTMLElement;
  modal: HTMLElement;
  closeModalButton: HTMLButtonElement;
  modalTitle: HTMLElement;
  modalEvents: HTMLElement;
  noEventsMessage: HTMLElement;
}

function getById<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function getCalendarDomRefs(): CalendarDomRefs | null {
  const container = getById<HTMLElement>(CALENDAR_IDS.container);
  const prevMonthButton = getById<HTMLButtonElement>(CALENDAR_IDS.prevMonthButton);
  const nextMonthButton = getById<HTMLButtonElement>(CALENDAR_IDS.nextMonthButton);
  const monthHeader = getById<HTMLElement>(CALENDAR_IDS.monthHeader);
  const timezoneSelect = getById<HTMLSelectElement>(CALENDAR_IDS.timezoneSelect);
  const grid = getById<HTMLElement>(CALENDAR_IDS.grid);
  const modal = getById<HTMLElement>(CALENDAR_IDS.modal);
  const closeModalButton = getById<HTMLButtonElement>(CALENDAR_IDS.closeModalButton);
  const modalTitle = getById<HTMLElement>(CALENDAR_IDS.modalTitle);
  const modalEvents = getById<HTMLElement>(CALENDAR_IDS.modalEvents);
  const noEventsMessage = getById<HTMLElement>(CALENDAR_IDS.noEventsMessage);

  if (
    !container ||
    !prevMonthButton ||
    !nextMonthButton ||
    !monthHeader ||
    !timezoneSelect ||
    !grid ||
    !modal ||
    !closeModalButton ||
    !modalTitle ||
    !modalEvents ||
    !noEventsMessage
  ) {
    return null;
  }

  return {
    container,
    prevMonthButton,
    nextMonthButton,
    monthHeader,
    timezoneSelect,
    grid,
    modal,
    closeModalButton,
    modalTitle,
    modalEvents,
    noEventsMessage,
  };
}

function showModal(modal: HTMLElement): void {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function hideModal(modal: HTMLElement): void {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function createTextElement(
  tagName: keyof HTMLElementTagNameMap,
  className: string,
  text: string,
): HTMLElement {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createEventCard(event: CalendarEvent): HTMLElement {
  const card = document.createElement("div");
  card.className = "flex flex-col p-4 rounded bg-slate-950 border border-slate-400/20 shadow-sm";

  card.appendChild(createTextElement("div", "font-bold text-slate-200 mb-1 text-lg", event.title));

  const timeText = event.isAllDay
    ? "All Day"
    : event.end
      ? `${formatTimeFromIso(event.start)} - ${formatTimeFromIso(event.end)}`
      : formatTimeFromIso(event.start);
  card.appendChild(createTextElement("div", "text-sm text-green-500 font-bold mb-2", timeText));

  if (event.location) {
    const location = document.createElement("div");
    location.className = "text-sm text-orange-500 mt-1 flex items-start gap-1.5";
    location.appendChild(createTextElement("span", "opacity-80", "📍"));
    location.appendChild(document.createTextNode(event.location));
    card.appendChild(location);
  }

  if (event.hangoutLink) {
    const meetWrapper = document.createElement("div");
    meetWrapper.className = "mt-2";

    const meetLink = document.createElement("a");
    meetLink.href = event.hangoutLink;
    meetLink.target = "_blank";
    meetLink.rel = "noopener noreferrer";
    meetLink.className = "text-sm text-teal-500 flex items-center gap-1.5 hover:underline w-fit";

    meetLink.appendChild(createTextElement("span", "opacity-80", "🎥"));
    meetLink.appendChild(document.createTextNode("Join Google Meet"));
    meetWrapper.appendChild(meetLink);
    card.appendChild(meetWrapper);
  }

  if (event.attendeesCount > 0) {
    const attendees = document.createElement("div");
    attendees.className = "text-xs text-slate-400 mt-2 flex items-center gap-1.5";
    attendees.appendChild(createTextElement("span", "opacity-80", "👥"));
    attendees.appendChild(document.createTextNode(`${event.attendeesCount} attendee(s)`));
    card.appendChild(attendees);
  }

  if (event.description) {
    card.appendChild(
      createTextElement(
        "div",
        "text-sm text-slate-200/80 mt-3 p-3 bg-slate-900 rounded max-h-32 overflow-y-auto hide-scrollbar break-words whitespace-pre-wrap",
        event.description,
      ),
    );
  }

  const linkContainer = document.createElement("div");
  linkContainer.className = "mt-4 pt-3 border-t border-slate-400/20 flex justify-end";

  const viewLink = document.createElement("a");
  viewLink.href = event.link;
  viewLink.target = "_blank";
  viewLink.rel = "noopener noreferrer";
  viewLink.className = "text-xs text-blue-400 hover:text-blue-500 hover:underline";
  viewLink.textContent = "View in Calendar";

  linkContainer.appendChild(viewLink);
  card.appendChild(linkContainer);

  return card;
}

function renderDayModal(day: Date, events: CalendarEvent[], refs: CalendarDomRefs): void {
  refs.modalTitle.textContent = formatReadableDay(day);
  refs.modalEvents.innerHTML = "";

  if (events.length === 0) {
    refs.noEventsMessage.classList.remove("hidden");
    refs.modalEvents.classList.add("hidden");
  } else {
    refs.noEventsMessage.classList.add("hidden");
    refs.modalEvents.classList.remove("hidden");
    events.forEach((event) => {
      refs.modalEvents.appendChild(createEventCard(event));
    });
  }

  showModal(refs.modal);
}

function buildEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  events.forEach((event) => {
    const startKey = dayKeyFromIso(event.start);
    if (!startKey) return;

    if (!event.end) {
      const dayEvents = grouped.get(startKey) ?? [];
      dayEvents.push(event);
      grouped.set(startKey, dayEvents);
      return;
    }

    const startDate = safeParseIsoDate(event.start);
    const endDate = safeParseIsoDate(event.end);

    if (!startDate || !endDate) {
      const dayEvents = grouped.get(startKey) ?? [];
      dayEvents.push(event);
      grouped.set(startKey, dayEvents);
      return;
    }

    const adjustedEnd = new Date(endDate.getTime() - 1);
    let daysSpanned: Date[];

    try {
      daysSpanned = eachDayOfInterval({ start: startDate, end: adjustedEnd });
    } catch {
      daysSpanned = [startDate];
    }

    daysSpanned.forEach((day) => {
      const dayKey = dayKeyFromDate(day);
      const dayEvents = grouped.get(dayKey) ?? [];
      dayEvents.push(event);
      grouped.set(dayKey, dayEvents);
    });
  });

  return grouped;
}

function createDayCell(
  day: Date,
  monthStart: Date,
  dayEvents: CalendarEvent[],
  refs: CalendarDomRefs,
): HTMLElement {
  const dayElement = document.createElement("div");
  const inCurrentMonth = isSameMonth(day, monthStart);
  const isToday = isSameDay(day, new Date());

  dayElement.className = `min-h-[80px] md:min-h-[100px] p-1 md:p-2 border rounded flex flex-col transition-colors cursor-pointer ${
    inCurrentMonth ? "bg-slate-950 border-slate-900" : "bg-transparent border-slate-950 opacity-40"
  } ${
    isToday ? "border-orange-500 bg-slate-900/50" : ""
  } hover:border-slate-400 hover:bg-slate-900`;

  const dateNumber = document.createElement("div");
  dateNumber.className = `text-right text-sm md:text-base font-bold ${
    inCurrentMonth ? "text-slate-200" : "text-slate-300"
  } ${isToday ? "text-orange-400" : ""}`;
  dateNumber.textContent = formatDayNumber(day);
  dayElement.appendChild(dateNumber);

  const eventsContainer = document.createElement("div");
  eventsContainer.className = "flex-1 overflow-y-auto mt-1 flex flex-col gap-1 hide-scrollbar";

  dayEvents.forEach((event) => {
    const chip = document.createElement("div");
    chip.title = event.title;
    chip.className = `text-xs px-1 py-0.5 rounded truncate block ${
      event.isAllDay
        ? "bg-teal-500 text-slate-950"
        : "bg-slate-900 text-blue-400 border border-blue-500/30"
    }`;

    if (event.isAllDay) {
      chip.textContent = event.title;
    } else {
      chip.textContent = `${formatTimeFromIso(event.start)} ${event.title}`;
    }

    eventsContainer.appendChild(chip);
  });

  dayElement.appendChild(eventsContainer);
  dayElement.addEventListener("click", () => {
    renderDayModal(day, dayEvents, refs);
  });

  return dayElement;
}

function renderCalendar(
  currentDate: Date,
  eventsByDay: Map<string, CalendarEvent[]>,
  refs: CalendarDomRefs,
): void {
  refs.monthHeader.textContent = formatMonthYear(currentDate);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const intervalStart = startOfWeek(monthStart);
  const intervalEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: intervalStart, end: intervalEnd });

  refs.grid.innerHTML = "";

  days.forEach((day) => {
    const dayEvents = eventsByDay.get(dayKeyFromDate(day)) ?? [];
    refs.grid.appendChild(createDayCell(day, monthStart, dayEvents, refs));
  });
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;

  return (
    typeof event.id === "string" &&
    typeof event.title === "string" &&
    typeof event.start === "string" &&
    typeof event.link === "string" &&
    typeof event.isAllDay === "boolean"
  );
}

function parseCalendarEventsPayload(payload: unknown): CalendarEvent[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter(isCalendarEvent);
}

function readEventsFromJsonScript(scriptId: string): CalendarEvent[] {
  const script = document.getElementById(scriptId);
  if (!script?.textContent) return [];

  try {
    return parseCalendarEventsPayload(JSON.parse(script.textContent));
  } catch {
    return [];
  }
}

function setupModalEvents(refs: CalendarDomRefs): void {
  refs.closeModalButton.addEventListener("click", () => {
    hideModal(refs.modal);
  });

  refs.modal.addEventListener("click", (event) => {
    if (event.target === refs.modal) {
      hideModal(refs.modal);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !refs.modal.classList.contains("hidden")) {
      hideModal(refs.modal);
    }
  });
}

export function initCalendar(events: CalendarEvent[]): void {
  const refs = getCalendarDomRefs();
  if (!refs) return;

  // Restore saved preference or use browser default
  const savedTz = localStorage.getItem("calendar-tz") ?? getActiveTimezone();
  refs.timezoneSelect.value = savedTz;
  // If the <select> rejected the value (no matching option), fall back to first option
  if (!refs.timezoneSelect.value) {
    refs.timezoneSelect.selectedIndex = 0;
  }
  setActiveTimezone(refs.timezoneSelect.value);

  let eventsByDay = buildEventsByDay(events);
  let currentDate = new Date();

  const rerender = () => {
    renderCalendar(currentDate, eventsByDay, refs);
  };

  refs.prevMonthButton.addEventListener("click", () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    rerender();
  });

  refs.nextMonthButton.addEventListener("click", () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    rerender();
  });

  refs.timezoneSelect.addEventListener("change", () => {
    setActiveTimezone(refs.timezoneSelect.value);
    localStorage.setItem("calendar-tz", refs.timezoneSelect.value);
    eventsByDay = buildEventsByDay(events);
    rerender();
  });

  setupModalEvents(refs);
  rerender();
}

export function initCalendarFromDom(scriptId: string): void {
  initCalendar(readEventsFromJsonScript(scriptId));
}
