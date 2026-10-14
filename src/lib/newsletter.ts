import { Resend } from "resend";

/**
 * The "LineCatch barbers" list in Resend. Newsletters go out from Resend → Broadcasts to this
 * segment, with Resend's own unsubscribe link. Not a secret: it's just the list's id.
 */
export const BARBER_SEGMENT_ID = process.env.RESEND_BARBER_SEGMENT_ID || "c1648782-26d2-4647-a644-c964f23f9ced";

/**
 * Adds a barber to the newsletter list. Safe to call more than once (an existing contact is just
 * added to the list again). Never throws: a newsletter hiccup must not break sign-up.
 */
export async function addBarberToNewsletter(b: { email: string | null | undefined; firstName?: string | null }): Promise<boolean> {
  const key = process.env.RESEND_CONTACTS_KEY;
  if (!key || !b.email) return false;
  try {
    const resend = new Resend(key);
    const created = await resend.contacts.create({
      email: b.email,
      ...(b.firstName ? { firstName: b.firstName } : {}),
      segments: [{ id: BARBER_SEGMENT_ID }],
    });
    if (!created.error) return true;
    // Already a contact (e.g. signed up before): make sure they're on the list.
    const added = await resend.contacts.segments.add({ email: b.email, segmentId: BARBER_SEGMENT_ID });
    if (added.error) console.error("[newsletter]", added.error.message);
    return !added.error;
  } catch (err) {
    console.error("[newsletter]", err);
    return false;
  }
}
