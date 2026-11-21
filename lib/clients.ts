// Client-safe client constants (used by both server pages and client components).

export const clientStatuses = ["lead", "assessment", "installing", "completed", "maintenance", "inactive"] as const;
export type ClientStatus = (typeof clientStatuses)[number];

export const clientStatusLabels: Record<ClientStatus, string> = {
  lead: "Lead",
  assessment: "Assessment",
  installing: "Installing",
  completed: "Completed",
  maintenance: "Maintenance",
  inactive: "Inactive",
};

export const isClientStatus = (s: unknown): s is ClientStatus =>
  typeof s === "string" && (clientStatuses as readonly string[]).includes(s);

export const bookingStatusList = ["new", "confirmed", "completed", "cancelled"] as const;
export type BookingStatusValue = (typeof bookingStatusList)[number];

export const bookingStatusLabels: Record<BookingStatusValue, string> = {
  new: "New",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};
