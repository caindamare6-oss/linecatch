import { Resend } from "resend";

/**
 * Who LineCatch email comes from. Until linecatch.app is verified in Resend, only
 * "onboarding@resend.dev" works, and only to the Resend account's own address.
 */
export const EMAIL_FROM = process.env.EMAIL_FROM || "LineCatch <support@linecatch.app>";

let client: Resend | null = null;

/** Checked on first use, so a missing key only affects email, never the rest of the app. */
function resend(): Resend {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set.");
  return (client ??= new Resend(process.env.RESEND_API_KEY));
}

/** Sends one email. Returns Resend's id, or null if it couldn't be sent (logged, never thrown). */
export async function sendEmail(opts: { to: string | string[]; subject: string; html: string; from?: string; replyTo?: string }): Promise<string | null> {
  try {
    const { data, error } = await resend().emails.send({
      from: opts.from || EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    if (error) {
      console.error("[email]", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error("[email]", err);
    return null;
  }
}
