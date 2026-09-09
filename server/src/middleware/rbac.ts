import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@nqt/shared';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Requires one of: [${allowedRoles.join(', ')}].`,
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}

