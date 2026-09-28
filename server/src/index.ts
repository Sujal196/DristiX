import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env.js';
import { connectDb, disconnectDb } from './db.js';
import { aiRouter } from './routes/ai.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { attemptRouter } from './routes/attempts.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { examRouter } from './routes/exams.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';

const app = express();

// ── Security headers ────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(
  helmet({
    // The API serves JSON and (optionally) static assets; a restrictive CSP is
    // set only when we serve the frontend ourselves.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header means a same-origin or non-browser request.
      if (!origin) return callback(null, true);

      // Returning false rather than throwing is deliberate: the request is
      // served without CORS headers so the browser blocks it. Throwing here
      // would surface as a 500 and log a stack trace on every rejected
      // cross-origin request — noise rather than security.
      return callback(null, env.corsOrigins.includes(origin));
    },
    credentials: true, // required for the refresh cookie
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api', apiLimiter);

// ── Routes ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dristix-api', env: env.NODE_ENV });
});

app.use('/api/auth', authRouter);
app.use('/api/exams', examRouter);
app.use('/api/attempts', attemptRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);

// ── Optional: serve the built frontend as a single deployable unit ──
if (env.SERVE_STATIC) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, '../../dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use('/api', notFound);
app.use(errorHandler);

// ── Boot ────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await connectDb();
  } catch (err) {
    console.error('\n❌ Could not connect to MongoDB.');
    console.error(`   ${err instanceof Error ? err.message : String(err)}\n`);
    console.error('   Check MONGODB_URI in server/.env and that mongod is running.\n');
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`\n  DristiX API listening on http://localhost:${env.PORT}`);
    console.log(`  mode: ${env.NODE_ENV}`);
    console.log(
      `  AI providers: gemini=${Boolean(env.GEMINI_API_KEY)} groq=${Boolean(env.GROQ_API_KEY)}`
    );
    console.log(`  registration: ${env.inviteCodes ? 'invite-only' : 'open'}\n`);
  });

  // Without this, a port clash surfaces as an unhandled 'error' event and a raw
  // Node stack trace. A clear message is far more useful than a crash dump.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n❌ Port ${env.PORT} is already in use.\n` +
          `   Another DristiX server is probably still running. Stop it, or set PORT in server/.env.\n`
      );
    } else {
      console.error(`\n❌ Server error: ${err.message}\n`);
    }
    process.exit(1);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received, shutting down.`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void start();
