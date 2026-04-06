import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthUser{
	id: string;
	email: string;
	role: 'applicant' | 'recruiter' | 'admin';
}

declare module "express-serve-static-core" {
	interface Request {
		user?: AuthUser;
	}
}

export function requireAuth(req: Request, res:Response, next: NextFunction): void {
	const header = req.headers.authorization;
	if (!header || !header.startsWith('Bearer ')) {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}

	if (!JWT_SECRET) {
		res.status(500).json({ message: "JWT_SECRET not configured" });
		return;
	}

	const token = header.slice('Bearer '.length);
	try {
		const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & {
			id?: string;
			email?: string;
			role?: AuthUser['role'];
		};

		if (!payload?.id || !payload?.email || !payload?.role) {
			res.status(401).json({ message: "Unauthorized" });
			return;
		}

		req.user = { id: payload.id, email: payload.email, role: payload.role };
		next();
	} catch {
		res.status(401).json({ message: "Unauthorized" });
		return;
	}
}