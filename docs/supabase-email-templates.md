# Supabase email templates (sign-up and sign-in links)

Paste these in **Supabase → Authentication → Emails → Templates**, in both projects
(staging `linecatch-staging` and live). The links use `token_hash`, which `/auth/callback`
verifies on the server, so a link works in whichever browser opens it (laptop sign-up, phone email).
The app always adds `?via=link` to the redirect, so `{{ .RedirectTo }}&...` is a valid URL.

## Confirm signup

**Subject:** Confirm your LineCatch account

```html
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;margin:0 0 16px">Line<span style="color:#B8925A">Catch</span></p>
  <p style="font-size:16px;margin:0 0 20px">Tap the button to finish signing up. It takes you straight to your shop setup.</p>
  <p style="margin:0 0 24px">
    <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email"
       style="display:inline-block;background:#D4AF7A;color:#1a1a1a;font-weight:bold;text-decoration:none;padding:14px 22px;border-radius:12px">
      Confirm and set up my shop
    </a>
  </p>
  <p style="font-size:13px;color:#666;margin:0">Didn't sign up for LineCatch? You can ignore this email.</p>
</div>
```

## Magic link

**Subject:** Your LineCatch sign-in link

```html
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
  <p style="font-size:22px;font-weight:bold;margin:0 0 16px">Line<span style="color:#B8925A">Catch</span></p>
  <p style="font-size:16px;margin:0 0 20px">Tap the button to sign in. The link works once and expires soon.</p>
  <p style="margin:0 0 24px">
    <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email"
       style="display:inline-block;background:#D4AF7A;color:#1a1a1a;font-weight:bold;text-decoration:none;padding:14px 22px;border-radius:12px">
      Sign in to LineCatch
    </a>
  </p>
  <p style="font-size:13px;color:#666;margin:0">Didn't ask to sign in? You can ignore this email.</p>
</div>
```

## Sender (removes "powered by Supabase")

**Authentication → Emails → SMTP Settings → Enable custom SMTP**

| Field | Value |
|---|---|
| Sender email | support@linecatch.app |
| Sender name | LineCatch |
| Host | smtp.resend.com |
| Port | 465 |
| Username | resend |
| Password | a Resend API key (Resend → API Keys → Create, "Sending access") |

The password is a secret: paste it yourself.
