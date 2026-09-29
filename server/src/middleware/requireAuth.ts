import type { NextFunction, Request, Response } from 'express';
import { User } from '../models/index.js';
import { verifyAccessToken } from '../services/auth.service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: 'STUDENT' | 'ADMIN'; email: string; name: string };
    }
  }
}

/**
 * Verifies the bearer access token and attaches the user.
 *
 * A 15-minute access token means this can expire mid-exam. The frontend
 * refreshes proactively and retries once on a 401, so a refresh failure here
 * is a genuine session end rather than routine token ageing.
 *
 * The exported wrapper is deliberate: Express 4 does not catch rejected
 * promises from async middleware, so an unhandled rejection here (e.g. a
 * transient MongoDB network error) would crash the whole process. Forwarding
 * the rejection to `next` routes it to the error handler as a 500 instead.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  void verifyUser(req, res, next).catch(next);
}

async function verifyUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
    return;
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: 'unauthorized', message: 'Session expired.' });
    return;
  }

  const user = await User.findById(payload.sub)
    .select('role email name')
    .lean()
    .exec();

  if (!user) {
    res.status(401).json({ error: 'unauthorized', message: 'Account no longer exists.' });
    return;
  }

  req.user = {
    id: String(user._id),
    role: user.role as 'STUDENT' | 'ADMIN',
    email: user.email,
    name: user.name,
  };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'forbidden', message: 'Administrator access required.' });
    return;
  }
  next();
}
