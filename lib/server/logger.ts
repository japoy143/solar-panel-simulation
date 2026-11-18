import pino, { type Logger, type LoggerOptions } from "pino";
import pretty from "pino-pretty";

// Structured server logger (pino). Production: one JSON object per line on stdout, ready for any
// log platform (Vercel, Datadog, Grafana Loki, CloudWatch…). Development: colourised and readable.
//
// Every log line carries `module` (and for Server Actions an `action` + `ref`), so a user-facing
// "Reference: ab12cd34" can be searched directly in the logs.
//
// Not marked `server-only` so proxy.ts and instrumentation.ts can use it; pino is Node-only anyway.

const isDev = process.env.NODE_ENV !== "production";

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: { service: "solar-layout" },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never write secrets to logs, even if they end up in a logged object by mistake.
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "apiKey",
      "*.apiKey",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
      "headers.cookie",
      "headers.authorization",
    ],
    censor: "[redacted]",
  },
  serializers: { err: pino.stdSerializers.err },
};

// Dev: pretty-print in-process. (pino's worker-thread `transport` option can't resolve its target
// once Next.js bundles the server, so the pretty stream is passed directly instead.)
export const logger: Logger = isDev
  ? pino(options, pretty({ colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname,service", sync: true }))
  : pino(options);

/** Logger for one area of the app, e.g. `moduleLogger("booking")`. */
export function moduleLogger(module: string) {
  return logger.child({ module });
}

/** "jo***@gmail.com" — enough to recognise a customer in logs without storing their full address. */
export function maskEmail(email: string | null | undefined) {
  if (!email) return undefined;
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

/** Short, human-friendly correlation id shown to users ("Reference: 3f9a1c2b"). */
export function newRef() {
  return crypto.randomUUID().slice(0, 8);
}
