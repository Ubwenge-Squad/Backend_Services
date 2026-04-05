import crypto from 'crypto';
import { VerificationTokenModel } from '../../models/VerificationToken.model';

export function generateNumericCode(length = 6): string {
	const digits = '0123456789';
	let code = '';
	for (let i = 0; i < length; i++) {
		code += digits[Math.floor(Math.random() * 10)];
	}
	return code;
}

export async function issueVerificationCode(email: string, purpose: 'register' | 'reset_password', ttlMinutes = 15): Promise<string> {
	const code = generateNumericCode(6);
	const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
	await VerificationTokenModel.create({ email, code, purpose, expiresAt });
	return code;
}

export async function consumeVerificationCode(email: string, purpose: 'register' | 'reset_password', code: string): Promise<boolean> {
	const token = await VerificationTokenModel.findOne({ email, purpose, code, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
	if (!token) {
		return false;
	}
	token.usedAt = new Date();
	await token.save();
	return true;
}

