import type { Instrumentation } from "next";

/**
 * Last-resort logging for any server error Next.js captures (render, Server Action, Route Handler,
 * proxy) that wasn't already handled. `digest` matches the id shown on the error page.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { moduleLogger } = await import("./lib/server/logger");
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  moduleLogger("next").error(
    {
      err,
      digest,
      method: request.method,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: "renderSource" in context ? context.renderSource : undefined,
    },
    "unhandled server error",
  );
};
