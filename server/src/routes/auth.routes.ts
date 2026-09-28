import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import { User } from '../models/index.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  clearRefreshCookie,
  hashPassword,
  REFRESH_COOKIE,
  setRefreshCookie,
  signAccessToken,
  toUserProfile,
  verifyAccessToken,
  verifyPassword,
} from '../services/auth.service.js';
import type { AuthResult } from '../../../shared/types.js';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  rollNumber: z.string().trim().min(2).max(40),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
  accessibilityPreference: z
    .enum(['Screen Reader', 'High Contrast', 'Low Vision', 'Standard'])
    .optional(),
  inviteCode: z.string().trim().optional(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(2),
  password: z.string().min(1),
});

function issue(res: import('express').Response, user: Parameters<typeof toUserProfile>[0]): void {
  const result: AuthResult = {
    user: toUserProfile(user),
    tokens: { accessToken: signAccessToken(user), expiresIn: env.ACCESS_TOKEN_TTL },
  };
  setRefreshCookie(res, result.tokens.accessToken);
  res.json(result);
}

/** POST /api/auth/register */
authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    // In production, registration requires an admin-issued invite code.
    if (env.inviteCodes && env.inviteCodes.length > 0) {
      if (!body.inviteCode || !env.inviteCodes.includes(body.inviteCode)) {
        throw new HttpError(403, 'invite_required', 'A valid invite code is required to register.');
      }
    }

    const email = body.email.toLowerCase();
    const existing = await User.findOne({ $or: [{ email }, { rollNumber: body.rollNumber }] })
      .select('_id')
      .lean()
      .exec();
    if (existing) {
      throw new HttpError(
        409,
        'already_registered',
        'That email or roll number is already registered.'
      );
    }

    const user = await User.create({
      name: body.name,
      email,
      rollNumber: body.rollNumber,
      passwordHash: await hashPassword(body.password),
      accessibilityPreference: body.accessibilityPreference ?? null,
      role: 'STUDENT',
    });

    issue(res, user);
  })
);

/** POST /api/auth/login */
authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const identifier = body.identifier.toLowerCase();

    const user = await User.findOne({
      $or: [{ email: identifier }, { rollNumber: identifier }],
    }).exec();

    // Compare against a dummy hash when the user is absent so that response
    // time does not reveal whether the account exists.
    const DUMMY =
      '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const hash = user?.passwordHash ?? DUMMY;
    const ok = await verifyPassword(body.password, hash);

    if (!user || !ok) {
      throw new HttpError(401, 'invalid_credentials', 'Invalid email/roll number or password.');
    }

    issue(res, user);
  })
);

/**
 * POST /api/auth/refresh
 *
 * Essential for long exams: the access token lives 15 minutes but an exam runs
 * up to 60, so the client refreshes proactively rather than being logged out
 * mid-question.
 */
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (typeof token !== 'string' || !token) {
      throw new HttpError(401, 'no_session', 'No active session.');
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      clearRefreshCookie(res);
      throw new HttpError(401, 'session_expired', 'Session expired. Please sign in again.');
    }

    const user = await User.findById(payload.sub).exec();
    if (!user) {
      clearRefreshCookie(res);
      throw new HttpError(401, 'session_expired', 'Session expired. Please sign in again.');
    }

    const accessToken = signAccessToken(user);
    setRefreshCookie(res, accessToken);
    res.json({
      user: toUserProfile(user),
      tokens: { accessToken, expiresIn: env.ACCESS_TOKEN_TTL },
    } satisfies AuthResult);
  })
);

/**
 * POST /api/auth/admin-login
 *
 * Separate from student login because administrators authenticate with a short
 * username rather than an email or roll number, and the role is checked here so
 * a student token can never be used to reach admin routes.
 */
authRouter.post(
  '/admin-login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = z
      .object({ username: z.string().trim().min(1), password: z.string().min(1) })
      .parse(req.body);

    const user = await User.findOne({
      username: username.toLowerCase(),
      role: 'ADMIN',
    }).exec();

    const DUMMY = '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY);

    if (!user || !ok) {
      throw new HttpError(401, 'invalid_credentials', 'Invalid administrator credentials.');
    }

    issue(res, user);
  })
);

/** GET /api/auth/me */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id).exec();
    if (!user) throw new HttpError(404, 'not_found', 'Account not found.');
    res.json({ user: toUserProfile(user) });
  })
);

/** POST /api/auth/logout */
authRouter.post('/logout', (_req, res) => {
  clearRefreshCookie(res);
  res.json({ ok: true });
});
