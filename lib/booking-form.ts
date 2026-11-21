// Shared by the booking form (client) and its Server Action.

/**
 * Name of the hidden "honeypot" input in BookingForm. People never see or fill it; form-spamming
 * bots fill every input, and the action then drops the request without saving or emailing.
 */
// Deliberately meaningless: a name like "company" or "website" would get autofilled by browsers,
// and real customers would then be silently dropped.
export const HONEYPOT_FIELD = "bk_hp";
