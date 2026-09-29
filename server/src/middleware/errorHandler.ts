import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../env.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

/** Terminal error handler. Never leaks a stack trace to the client. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation_error',
      message: 'Request payload is invalid.',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  // Body-parser failures carry their own status/type and must not be flattened
  // into an opaque 500 — "payload too large" tells the admin their image is
  // simply too big, a 500 tells them nothing.
  const parseErr = err as { type?: string; status?: number; statusCode?: number };
  if (parseErr?.type === 'entity.too.large') {
    res.status(413).json({
      error: 'payload_too_large',
      message: 'The uploaded content is too large. Try a smaller image.',
    });
    return;
  }
  if (parseErr?.type === 'entity.parse.failed') {
    res.status(400).json({
      error: 'invalid_json',
      message: 'The request body is not valid JSON.',
    });
    return;
  }

  console.error('[dristix] unhandled error:', err);
  const status = typeof parseErr?.status === 'number' ? parseErr.status
    : typeof parseErr?.statusCode === 'number' ? parseErr.statusCode
    : 500;
  res.status(status).json({
    error: status >= 500 ? 'internal_error' : 'request_error',
    message: 'Something went wrong on the server.',
    ...(env.isProd ? {} : { details: err instanceof Error ? err.message : String(err) }),
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'not_found', message: 'No such endpoint.' });
}

/** Wraps an async handler so rejected promises reach the error handler. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req as T, res, next).catch(next);
  };
}
