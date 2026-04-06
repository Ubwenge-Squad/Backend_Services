import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser{
	id: string;
	email: string;
	role: 'applicant' | 'recruiter' | 'admin';
}

declare global {
	namespace Express {
		interface Request {
			user?: AuthUser;
		}
	}
}

export function requireAuth(req: Request, res:Response, next: NextFunction): void {
	const jwtSecret = process.env.JWT_SECRET;
	if (!jwtSecret) {
		res.status(500).json({ message: "JWT secret is not configured" });
		return;
	}
	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith('Bearer ')) {
		res.status(401).json({ message: "Unauthorized: Missing or invalid token format" });
		return;
	}
	const token = authHeader.split(' ')[1];
	if (!token) {
		res.status(401).json({ message: "Unauthorized: Token missing" });
		return;
	}
	try {
		const payload = jwt.verify(token, jwtSecret) as AuthUser;
		req.user = payload;
		next();
	}
	catch(error:any){
		if(error.name === 'TokenExpiredError'){
			res.status(401).json({message: "Token expired"});
			return;
		}
		res.status(401).json({message: "Unauthorized: Invalid token"});
		return;
	}
}

export function requireRole(role: AuthUser['role'][]): (req:Request, res:Response, next:NextFunction) => void{
	return (req:Request, res:Response, next:NextFunction) => {
		const user = req.user;
		if(!user){
			res.status(401).json({message: "Unauthorized: No user session"});
			return;
		}
		if(!role.includes(user.role)){
			res.status(403).json({message: "Forbidden: User does not have required role"});
			return;
		}
		next();
	};
}