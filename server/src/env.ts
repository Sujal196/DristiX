import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Load .env from cwd and check relative locations
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
try {
  const here = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(here, '../.env') });
  dotenv.config({ path: path.resolve(here, '../../.env') });
  dotenv.config({ path: path.resolve(here, '../../../.env') });
} catch {
  // Ignored in non-file environments
}

/**
 * Fails fast on boot if the environment is incomplete. A server that starts
 * with a missing JWT secret is worse than one that refuses to start.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  /** Logical database name, kept separate from the URI so one URI can host
   *  several environments without rewriting the connection string. */
  MONGODB_DB: z.string().min(1).default('dristix'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900), // 15 minutes
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),

  /** When set, self-registration is rejected without a valid invite code. */
  INVITE_CODES: z.string().optional(),

  /** Proxy targets. Absent keys simply disable that provider. */
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  /** Serve the built frontend from ./dist in production. */
  SERVE_STATIC: z.coerce.boolean().default(false),

  /** Optional SMTP mailer configuration for sending password reset emails. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  EMAIL_FROM: z.string().default('DristiX Security <noreply@dristix.edu>'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid server environment:\n');
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nCopy server/.env.example to server/.env and fill it in.\n');
  console.error('The MongoDB database name is separate from your other local databases.\n');
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  inviteCodes: raw.INVITE_CODES
    ? raw.INVITE_CODES.split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    : null,
};
