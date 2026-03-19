import fs from "fs";
import path from "path";
import * as eventStore from "./eventStore";

const LOG_DIR  = path.resolve(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "backend.log");

// Ensure logs/ exists at startup
fs.mkdirSync(LOG_DIR, { recursive: true });

type Level = "info" | "warn" | "error";

function write(level: Level, type: string, data: Record<string, unknown> = {}): void {
  const entry = { timestamp: new Date().toISOString(), level, type, ...data };

  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    console.error("[logger] file write failed:", err);
  }

  eventStore.push(entry);

  const extras = Object.keys(data).length ? " " + JSON.stringify(data) : "";
  console.log(`[${level.toUpperCase()}] [${type}]${extras}`);
}

export const logger = {
  info:  (type: string, data?: Record<string, unknown>) => write("info",  type, data),
  warn:  (type: string, data?: Record<string, unknown>) => write("warn",  type, data),
  error: (type: string, data?: Record<string, unknown>) => write("error", type, data),
};
