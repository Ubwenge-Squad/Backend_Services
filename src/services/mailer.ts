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
	const title = args.purpose === 'register'
		? 'Verify your Intore account'
		: args.purpose === 'login_otp'
			? 'Your Intore login code'
			: 'Reset your Intore password';
	const subtitle = args.purpose === 'register'
		? 'Use this code to verify your email address:'
		: args.purpose === 'login_otp'
			? 'Use this one-time code to complete your sign in:'
			: 'Use this code to reset your password:';

	const text = `${title}\n\n${subtitle}\n\n${args.code}\n\nThis code expires in ${args.ttlMinutes} minutes.`;
	const html = `
  <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5;">
    <h2 style="margin:0 0 12px;">${title}</h2>
    <p style="margin:0 0 12px;">${subtitle}</p>
    <div style="font-size:24px; letter-spacing:6px; font-weight:700; padding:12px 16px; border:1px solid #e5e7eb; border-radius:10px; display:inline-block;">
      ${args.code}
    </div>
    <p style="margin:12px 0 0; color:#6b7280;">This code expires in ${args.ttlMinutes} minutes.</p>
  </div>
  `;
	return { subject: title, text, html };
}

