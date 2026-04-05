import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
	id: string;
	role: 'applicant' | 'recruiter' | 'admin';
	email: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
	const header = req.headers.authorization;
	if (!header || !header.startsWith('Bearer ')) {
		res.status(401).json({ message: 'Unauthorized' });
		return;
	}
	const token = header.slice('Bearer '.length);
	// TODO: verify JWT when auth is implemented
	(req as any).user = { id: 'placeholder', role: 'recruiter', email: 'placeholder@example.com' } as AuthUser;
	next();
}

export function requireRole(roles: AuthUser['role'][]): (req: Request, res: Response, next: NextFunction) => void {
	return (req: Request, res: Response, next: NextFunction) => {
		const user = (req as any).user as AuthUser | undefined;
		if (!user || !roles.includes(user.role)) {
			res.status(403).json({ message: 'Forbidden' });
			return;
		}
		next();
	};
}

