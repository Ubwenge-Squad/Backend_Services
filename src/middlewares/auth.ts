import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthUser{
	id: string;
	email: string;
	role: 'applicant' | 'recruiter' | 'admin';
}

declare global {
	namespace Experss {
		interface Request {
			user?: AuthUser
		}
	}
}

export function requireAuth(req: Request, res:Response, next: NextFunction): void {
	const header =req.headers.authorization;
	if(!header || !header.startsWith('Bearer ')){
		res.status(401).json({message: "Unauthorized"});
		return;
	}
}