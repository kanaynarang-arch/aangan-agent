import { RULES } from "./rules";

/** Is an instant outside the front desk's 10am-7pm (India time)? */
export function isOutsideHours(d: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: RULES.TIME_ZONE }).format(d)) % 24;
  return hour < RULES.OFFICE_OPEN_HOUR || hour >= RULES.OFFICE_CLOSE_HOUR;
}

/** "Monday 2026-09-07 10:23" in India time, given to the model as the call date. */
export function callDateLabel(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: RULES.TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
      weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.weekday} ${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
