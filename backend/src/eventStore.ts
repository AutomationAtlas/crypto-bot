// In-memory ring buffer of the last MAX_EVENTS log events.
// Written to by logger.ts; read by GET /api/events.

const MAX_EVENTS = 100;

export interface LogEvent {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error";
  type: string;
  [key: string]: unknown;
}

const events: LogEvent[] = [];
let seq = 0;

export function push(event: Omit<LogEvent, "id">): LogEvent {
  const record = { id: ++seq, ...event } as LogEvent;
  events.push(record);
  if (events.length > MAX_EVENTS) events.shift();
  return record;
}

/** Returns up to MAX_EVENTS in reverse chronological order, optionally filtered by type. */
export function getEvents(type?: string): LogEvent[] {
  const source = type ? events.filter((e) => e.type === type) : events;
  return source.slice().reverse();
}
