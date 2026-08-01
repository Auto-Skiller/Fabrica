import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  tenantId?: string;
  user?: any;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Extract tenantId from headers, query string, or default to 'default_user'
  const headerTenant = req.headers['x-tenant-id'] || req.headers['x-user-id'];
  const queryTenant = req.query.tenantId || req.query.userId;
  const tenantId = (typeof headerTenant === 'string' ? headerTenant : typeof queryTenant === 'string' ? queryTenant : 'default_user').replace(/[^a-zA-Z0-9_\-]/g, '_');

  req.tenantId = tenantId || 'default_user';
  next();
}
