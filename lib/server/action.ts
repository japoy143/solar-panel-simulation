import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { Logger } from "pino";
import { moduleLogger, newRef } from "./logger";

const log = moduleLogger("action");

export type ActionContext = {
  /** Child logger tagged with the action name and this call's reference id. */
  log: Logger;
  /** Correlation id: include it in user-facing errors so support can find the log line. */
  ref: string;
};

/**
 * Runs a Server Action body with logging and a safety net:
 * - logs start (debug), success (info) and duration;
 * - on an unexpected throw, logs the error with a reference id and returns `onError(ref)`
 *   instead of crashing the page;
 * - lets Next.js control-flow errors (redirect, notFound…) pass through untouched.
 */
export async function runAction<T>(
  name: string,
  body: (ctx: ActionContext) => Promise<T>,
  onError: (ref: string) => T,
): Promise<T> {
  const ref = newRef();
  const actionLog = log.child({ action: name, ref });
  const started = performance.now();
  actionLog.debug("action started");
  try {
    const result = await body({ log: actionLog, ref });
    actionLog.info({ durationMs: Math.round(performance.now() - started) }, "action finished");
    return result;
  } catch (err) {
    unstable_rethrow(err); // redirect()/notFound() are not failures
    actionLog.error({ err, durationMs: Math.round(performance.now() - started) }, "action failed");
    return onError(ref);
  }
}

/** Standard user-facing message for an unexpected failure. */
export const unexpected = (ref: string) => `Something went wrong. Please try again. (Reference: ${ref})`;
