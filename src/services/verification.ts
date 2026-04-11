import crypto from 'crypto';
import { VerificationTokenModel } from '../models/VerificationToken.model';
import { buildVerificationEmail, sendMail } from './mailer';

export function generateNumericCode(length = 6): string {
	const digits = '0123456789';
	let code = '';
	for (let i = 0; i < length; i++) {
		code += digits[Math.floor(Math.random() * 10)];
	}
	return code;
}

export async function issueVerificationCode(email: string, purpose: 'register' | 'reset_password' | 'login_otp', ttlMinutes = 15): Promise<string> {
	const code = generateNumericCode(6);
	const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
	await VerificationTokenModel.create({ email, code, purpose, expiresAt });

	// Best-effort email sending. If SMTP is not configured, we still issue the code
	// (useful for local/dev), but production should configure SMTP.
	try {
		const msg = buildVerificationEmail({ code, purpose, ttlMinutes });
		await sendMail({ to: email, subject: msg.subject, text: msg.text, html: msg.html });
	} catch (err) {
		if (process.env.NODE_ENV === 'production') {
			// In production, failing to send the code should be a hard failure.
			throw err;
		}
	}
	return code;
}

export async function consumeVerificationCode(email: string, purpose: 'register' | 'reset_password' | 'login_otp', code: string): Promise<boolean> {
	const token = await VerificationTokenModel.findOne({ email, purpose, code, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
	if (!token) {
		return false;
	}
	token.usedAt = new Date();
	await token.save();
	return true;
}

