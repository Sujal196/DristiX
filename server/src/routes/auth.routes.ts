import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import { User, PasswordReset } from '../models/index.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
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
  verifyRefreshToken,
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
  setRefreshCookie(res, user);
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
    const rawIdentifier = body.identifier.trim();
    const identifier = rawIdentifier.toLowerCase();
    const upperIdentifier = rawIdentifier.toUpperCase();

    const possibleRolls = Array.from(
      new Set([
        rawIdentifier,
        upperIdentifier,
        identifier,
        ...(rawIdentifier.match(/^\d+$/) ? [`DX-${rawIdentifier}`] : []),
      ])
    );

    const user = await User.findOne({
      $or: [{ email: identifier }, { rollNumber: { $in: possibleRolls } }],
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

    const payload = verifyRefreshToken(token);
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
    setRefreshCookie(res, user);
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

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.length <= 2 ? name[0] : name.slice(0, 2);
  const hiddenCount = Math.max(3, name.length - visible.length);
  return `${visible}${'*'.repeat(hiddenCount)}@${domain}`;
}

/**
 * POST /api/auth/forgot-password
 *
 * Initiates the password reset workflow by looking up the candidate/administrator
 * and emailing a secure 6-digit OTP code with a 15-minute expiry.
 */
authRouter.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { identifier, portal } = z
      .object({
        identifier: z.string().trim().min(1, 'Identifier (email, roll number, or username) is required.'),
        portal: z.enum(['student', 'admin']).default('student'),
      })
      .parse(req.body);

    const cleanIdent = identifier.toLowerCase();

    // Query user according to portal scope
    let user = null;
    if (portal === 'admin') {
      user = await User.findOne({
        role: 'ADMIN',
        $or: [{ email: cleanIdent }, { username: cleanIdent }, { rollNumber: cleanIdent.toUpperCase() }],
      }).exec();
    } else {
      user = await User.findOne({
        role: 'STUDENT',
        $or: [{ email: cleanIdent }, { rollNumber: cleanIdent.toUpperCase() }, { rollNumber: cleanIdent }],
      }).exec();
    }

    if (!user) {
      // Neutral message to avoid user enumeration
      res.json({
        ok: true,
        message: 'If an account matches those details, a verification code has been dispatched to the registered email.',
      });
      return;
    }

    // Clean up any pending previous tokens for this email
    await PasswordReset.deleteMany({ email: user.email }).exec();

    // Generate secure 6-digit verification code and reset token
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const resetToken = crypto.randomBytes(32).toString('hex');
    const codeHash = await hashPassword(verificationCode);

    await PasswordReset.create({
      email: user.email,
      codeHash,
      resetToken,
      role: user.role,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
    });

    await sendPasswordResetEmail(user.email, user.name, verificationCode, resetToken, portal);

    res.json({
      ok: true,
      message: `A password reset link and 6-digit code have been dispatched to ${maskEmail(user.email)}. Please check your Gmail / Email inbox.`,
      maskedEmail: maskEmail(user.email),
      email: user.email,
    });
  })
);

/**
 * POST /api/auth/validate-reset-token
 *
 * Verifies that a resetToken (e.g. from an email link) is valid and unexpired.
 */
authRouter.post(
  '/validate-reset-token',
  asyncHandler(async (req, res) => {
    const { email, resetToken } = z
      .object({
        email: z.string().trim().email(),
        resetToken: z.string().min(1),
      })
      .parse(req.body);

    const record = await PasswordReset.findOne({
      email: email.toLowerCase(),
      resetToken,
      used: false,
      expiresAt: { $gt: new Date() },
    }).exec();

    if (!record) {
      throw new HttpError(
        400,
        'invalid_token',
        'This password reset link has expired or already been used. Please request a new one.'
      );
    }

    res.json({ ok: true, valid: true });
  })
);

/**
 * POST /api/auth/verify-reset-code
 *
 * Verifies the 6-digit code against the stored hash and returns a scoped reset token.
 */
authRouter.post(
  '/verify-reset-code',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = z
      .object({
        email: z.string().trim().email(),
        code: z.string().trim().min(6).max(6),
      })
      .parse(req.body);

    const record = await PasswordReset.findOne({
      email: email.toLowerCase(),
      used: false,
      expiresAt: { $gt: new Date() },
    }).exec();

    if (!record) {
      throw new HttpError(
        400,
        'invalid_or_expired_code',
        'The verification code has expired or is invalid. Please request a new code.'
      );
    }

    if (record.attempts >= 5) {
      await PasswordReset.deleteOne({ _id: record._id }).exec();
      throw new HttpError(429, 'too_many_attempts', 'Too many invalid attempts. Please request a fresh code.');
    }

    const ok = await verifyPassword(code, record.codeHash);
    if (!ok) {
      record.attempts += 1;
      await record.save();
      throw new HttpError(400, 'invalid_code', 'Incorrect verification code. Please check your email and try again.');
    }

    res.json({
      ok: true,
      resetToken: record.resetToken,
      message: 'Code verified successfully. You may now create your new password.',
    });
  })
);

/**
 * POST /api/auth/reset-password
 *
 * Authenticates with the one-time resetToken and updates the account password.
 */
authRouter.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, resetToken, newPassword } = z
      .object({
        email: z.string().trim().email(),
        resetToken: z.string().min(1),
        newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(200),
      })
      .parse(req.body);

    const record = await PasswordReset.findOne({
      email: email.toLowerCase(),
      resetToken,
      used: false,
      expiresAt: { $gt: new Date() },
    }).exec();

    if (!record) {
      throw new HttpError(
        400,
        'invalid_session',
        'Password reset session has expired or is invalid. Please restart the reset process.'
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() }).exec();
    if (!user) {
      throw new HttpError(404, 'user_not_found', 'User account not found.');
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    // Mark reset token as consumed
    record.used = true;
    await record.save();
    await PasswordReset.deleteMany({ email: user.email }).exec();

    res.json({
      ok: true,
      message: 'Your password has been successfully updated. You may now sign in with your new password.',
    });
  })
);

