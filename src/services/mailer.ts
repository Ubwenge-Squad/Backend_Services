import nodemailer from 'nodemailer';

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`${name} is required for email sending`);
	return v;
}

export function createTransport() {
	const host = process.env.SMTP_HOST || 'smtp.gmail.com';
	const port = Number(process.env.SMTP_PORT || 465);
	const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
	const user = requireEnv('SMTP_USER');
	const pass = requireEnv('SMTP_PASS');

	return nodemailer.createTransport({
		host,
		port,
		secure,
		auth: { user, pass }
	});
}

export async function sendMail(params: { to: string; subject: string; text: string; html?: string }) {
	const transport = createTransport();
	const fromName = process.env.MAIL_FROM_NAME || 'Intore';
	const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@intore.local';
	return transport.sendMail({
		from: `${fromName} <${fromEmail}>`,
		to: params.to,
		subject: params.subject,
		text: params.text,
		html: params.html
	});
}

export function buildVerificationEmail(args: { code: string; purpose: 'register' | 'reset_password' | 'login_otp'; ttlMinutes: number }) {
	const isLogin = args.purpose === 'login_otp';
	const isRegister = args.purpose === 'register';

	const title = isRegister ? 'Verify your Intore account' : isLogin ? 'Your Intore sign-in code' : 'Reset your Intore password';
	const subtitle = isRegister
		? 'Welcome to Intore! Use the code below to verify your email address and activate your account.'
		: isLogin
			? 'Someone (hopefully you) is signing in to Intore. Use the code below to complete your login.'
			: 'Use the code below to reset your Intore password.';
	const warning = isLogin
		? 'If you did not attempt to sign in, please secure your account immediately.'
		: isRegister
			? 'If you did not create an account, you can safely ignore this email.'
			: 'If you did not request a password reset, you can safely ignore this email.';

	const text = `${title}\n\n${subtitle}\n\nYour code: ${args.code}\n\nThis code expires in ${args.ttlMinutes} minutes.\n\n${warning}\n\n— The Intore Team`;

	const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0F1547 0%,#1a2060 100%);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 5.5 54.5 32 32 58.5 9.5 32 32 5.5Z" stroke="#4B7BFF" stroke-width="4.5" stroke-linejoin="round"/>
                <circle cx="32" cy="32" r="6.5" fill="#4B7BFF"/>
              </svg>
              <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Intore</span>
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">${title}</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">${subtitle}</p>
            <!-- Code box -->
            <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;">Your verification code</p>
              <div style="font-size:36px;font-weight:800;letter-spacing:12px;color:#0f172a;font-family:monospace;">${args.code}</div>
              <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">Expires in <strong>${args.ttlMinutes} minutes</strong></p>
            </div>
            <!-- Warning -->
            <div style="background:#fef9ec;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#92400e;">${warning}</p>
            </div>
            <p style="margin:0;font-size:14px;color:#64748b;">Need help? Reply to this email or contact our support team.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">© 2026 Intore · Built for Rwanda's growing workforce</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

	return { subject: `[Intore] ${title}`, text, html };
}

