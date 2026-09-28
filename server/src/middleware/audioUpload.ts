import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errorHandler.js';

/**
 * Minimal multipart handling for a single `audio` field.
 *
 * multer would do this, but the only upload in the app is one audio clip, and
 * a hand-rolled reader keeps the dependency surface small. It buffers the file
 * into memory, which is fine here because the recorder stops after a few
 * seconds of speech and the provider caps uploads far below this limit.
 */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

export const audioUpload = (req: Request, _res: Response, next: NextFunction): void => {
  const contentType = req.headers['content-type'] ?? '';
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) {
    next(new HttpError(400, 'no_audio', 'Expected a multipart upload with an audio file.'));
    return;
  }
  const boundary = `--${match[1] ?? match[2]}`;

  const chunks: Buffer[] = [];
  let total = 0;

  req.on('data', (chunk: Buffer) => {
    total += chunk.length;
    if (total > MAX_AUDIO_BYTES) {
      next(new HttpError(413, 'audio_too_large', 'The audio clip is too large.'));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('error', () => {
    next(new HttpError(400, 'upload_failed', 'The audio upload failed.'));
  });

  req.on('end', () => {
    try {
      const body = Buffer.concat(chunks);
      const parsed = extractFile(body, boundary);
      if (!parsed) {
        next(new HttpError(400, 'no_audio', 'No audio file was found in the upload.'));
        return;
      }
      (req as Request & { file?: typeof parsed }).file = parsed;
      next();
    } catch (err) {
      next(err instanceof HttpError ? err : new HttpError(400, 'upload_failed', 'The audio upload could not be read.'));
    }
  });
};

function extractFile(
  body: Buffer,
  boundary: string
): { buffer: Buffer; mimetype: string; originalname: string } | null {
  const parts = body.toString('latin1').split(boundary);

  for (const part of parts) {
    // Each part starts with CRLF then the headers.
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const rawHeaders = part.slice(0, headerEnd);
    if (!/name="audio"/i.test(rawHeaders)) continue;

    const filename = rawHeaders.match(/filename="([^"]*)"/i)?.[1] ?? 'clip.webm';
    const mimetype = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? 'audio/webm';

    // Trailing CRLF before the next boundary is not part of the file.
    let end = part.length;
    if (part.endsWith('\r\n')) end -= 2;
    const payload = part.slice(headerEnd + 4, end);

    return { buffer: Buffer.from(payload, 'latin1'), mimetype, originalname: filename };
  }
  return null;
}
