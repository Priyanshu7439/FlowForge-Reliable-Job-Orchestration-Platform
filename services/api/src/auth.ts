import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

export interface Session { userId: string; role: 'USER' | 'ADMIN'; }
export const hashPassword = (value: string) => argon2.hash(value);
export const verifyPassword = (hash: string, value: string) => argon2.verify(hash, value);
export function setSession(response: Response, session: Session) { response.cookie('flowforge_session', jwt.sign(session, config.JWT_SECRET, { expiresIn: '8h' }), { httpOnly: true, sameSite: 'lax', secure: config.COOKIE_SECURE, maxAge: 8 * 60 * 60 * 1000 }); }
export function requireAuth(request: Request, response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.flowforge_session;
    if (!token) return response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId: request.id } });
    request.session = jwt.verify(token, config.JWT_SECRET) as Session;
    next();
  } catch { response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId: request.id } }); }
}
export function requireRole(...roles: Session['role'][]) {
  return (request: Request, response: Response, next: NextFunction) => requireAuth(request, response, () => {
    if (!request.session || !roles.includes(request.session.role)) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role permissions', requestId: request.id } });
    next();
  });
}
declare global { namespace Express { interface Request { id: string; session?: Session; } } }
