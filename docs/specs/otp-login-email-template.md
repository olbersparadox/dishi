# OTP login — Supabase email template (dashboard config, not in git)

The OTP login path (see `otp-login.md`) needs the sign-in email to lead with the
**code** and carry **no magic link**. That template lives in the Supabase
dashboard, not the repo, so the exact final version is recorded here.

## Where to paste it

Supabase dashboard → **Authentication → Email Templates → Magic Link**.
(Supabase sends this same "Magic Link" template for `signInWithOtp`; replacing
its body with the code-only version below turns every sign-in email into a pure
OTP email.)

Also check **Authentication → Providers → Email → Email OTP Expiration / OTP
length**. This project's OTP length is **8 digits** (the app input is
length-agnostic, so 6 or 8 both work — but the on-screen copy is deliberately
digit-agnostic, so whichever length is set here stays honest). If you want the
classic 6-digit hero, set OTP length to 6 here; nothing in the app needs to
change.

## Template body

Why this shape: Apple Mail's one-time-code detector keys on a short numeric
string sitting **near a code-word** ("code" / "驗證碼"). Keeping the token on its
own line, large, immediately under both words maximizes the chance iOS offers it
as a keyboard chip. No `{{ .ConfirmationURL }}` anywhere — the link is what we're
killing.

```html
<h2 style="margin:0 0 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">dishi</h2>

<p style="margin:0 0 4px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#333;">
  你嘅登入驗證碼 · Your sign-in code
</p>

<p style="margin:0 0 16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:6px;color:#111;">
  {{ .Token }}
</p>

<p style="margin:0 0 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#333;">
  喺你開始登入嗰個瀏覽器度輸入呢個碼。<br>
  Enter this code in the browser where you started. It expires shortly.
</p>

<p style="margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px;color:#999;">
  如果唔係你要求嘅，可以忽略呢封電郵。<br>
  If you didn't request this, you can safely ignore this email.
</p>
```

## Verify after pasting

1. Request a code from the app on a real iPhone in Safari.
2. Apple Mail should show the code as a chip above the keyboard (the app input
   declares `autoComplete="one-time-code"`).
3. Tapping the chip fills it; Verify signs you in **in Safari** — no browser
   switch. Confirm the email contains no tappable sign-in link.
