import { Request, Response, NextFunction, response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

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
	const header =req.headers.authorization;
	if(!header || !header.startsWith('Bearer ')){
		res.status(401).json({message: "Unauthorized"});
		return;
	}
	const token = header.slice('Bearer'.length).trim();
	if(!token){
		res.status(401).json({message: "Unauthorized"});
		return;
	}
	try {
		const payload = jwt.verify(token, JWT_SECRET!)as AuthUser;
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