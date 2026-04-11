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

	// Best-effort email sending — never block registration/login on email failure.
	// The code is always returned so the caller can surface it (devCode in non-prod).
	try {
		const msg = buildVerificationEmail({ code, purpose, ttlMinutes });
		await sendMail({ to: email, subject: msg.subject, text: msg.text, html: msg.html });
	} catch (err) {
		console.error(`[issueVerificationCode] Email send failed for ${email} (${purpose}):`, err);
		// Do NOT re-throw — the code is already saved in DB, user can still verify.
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

