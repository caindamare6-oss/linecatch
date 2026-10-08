type PhoneResult =
  | { valid: true; e164: string }
  | { valid: false; error: string };

const NANP = /^[2-9]\d{2}[2-9]\d{6}$/;

export function normalizePhone(raw: string): PhoneResult {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.startsWith("1") && digits.length === 11
    ? digits.slice(1)
    : digits;

  if (ten.length !== 10 || !NANP.test(ten)) {
    return { valid: false, error: "Enter a valid 10-digit US/CA phone number" };
  }

  return { valid: true, e164: `+1${ten}` };
}
