import { getAdmin } from "@/lib/auth";
import { getNotifications } from "@/lib/data/messages";
import { moduleLogger } from "@/lib/server/logger";

/**
 * Data for the admin notification bell (polled by components/admin/notification-bell.tsx).
 * Outside proxy.ts's /admin matcher, so it checks the session itself.
 */
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const data = await getNotifications();
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    moduleLogger("api.notifications").error({ err }, "notifications failed");
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
