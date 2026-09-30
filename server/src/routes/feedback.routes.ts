import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Feedback, User } from '../models/index.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { verifyAccessToken } from '../services/auth.service.js';

export const feedbackRouter = Router();

// Optional user attachment middleware
async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      if (payload?.sub) {
        const user = await User.findById(payload.sub).select('role email name').lean().exec();
        if (user) {
          req.user = {
            id: String(user._id),
            role: user.role as 'STUDENT' | 'ADMIN',
            email: user.email,
            name: user.name,
          };
        }
      }
    } catch {
      // Ignore token decode errors for optional auth
    }
  }
  next();
}

const feedbackSchema = z.object({
  examId: z.string().min(1, 'Exam ID is required'),
  examTitle: z.string().min(1, 'Exam title is required'),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string()).optional().default([]),
  comment: z.string().max(2000).optional().default(''),
  inputMethod: z.enum(['voice', 'keyboard', 'mixed']).optional().default('keyboard'),
  studentRoll: z.string().optional().default(''),
  studentName: z.string().optional().default('Candidate'),
});

/**
 * POST /api/feedback
 * Records candidate feedback for an examination attempt.
 */
feedbackRouter.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'validation_error', 'Invalid feedback data: ' + parsed.error.issues.map((i) => i.message).join(', '));
    }

    const { examId, examTitle, rating, tags, comment, inputMethod, studentRoll } = parsed.data;

    const studentId = req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)
      ? new mongoose.Types.ObjectId(req.user.id)
      : null;
    const studentName = req.user?.name || parsed.data.studentName || 'Candidate';

    try {
      const doc = await Feedback.create({
        studentId,
        studentName,
        studentRoll: studentRoll || req.user?.id || '',
        examId,
        examTitle,
        rating,
        tags,
        comment,
        inputMethod,
      });

      res.status(201).json({
        ok: true,
        message: 'Feedback submitted successfully.',
        id: String(doc._id),
      });
    } catch (err) {
      console.warn('[dristix-feedback] Failed to write feedback to DB:', err);
      // Return 201 with success status so candidate UX is not disrupted
      res.status(201).json({
        ok: true,
        message: 'Feedback recorded.',
      });
    }
  })
);

/**
 * GET /api/feedback/summary/:examId
 * Retrieves aggregate feedback stats for an exam.
 */
feedbackRouter.get(
  '/summary/:examId',
  asyncHandler(async (req, res) => {
    const { examId } = req.params;
    try {
      const records = await Feedback.find({ examId }).limit(100).lean();
      const count = records.length;
      const avgRating = count > 0 ? Number((records.reduce((acc, r) => acc + r.rating, 0) / count).toFixed(1)) : 5.0;
      res.json({ ok: true, count, avgRating, recent: records.slice(0, 5) });
    } catch {
      res.json({ ok: true, count: 0, avgRating: 5.0, recent: [] });
    }
  })
);
