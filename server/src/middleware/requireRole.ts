import { Request, Response, NextFunction } from 'express';
import { AuthUser } from './auth';

/**
 * Server-side role enforcement middleware.
 * This is not a UI-only check — every protected route goes through this.
 * Dispatchers and technicians have different capabilities enforced here.
 */
export function requireRole(...roles: Array<'DISPATCHER' | 'TECHNICIAN'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as AuthUser | undefined;

    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${user.role}`,
      });
      return;
    }

    next();
  };
}
