# DristiX Backend

Node.js + Express + MongoDB backend for DristiX.

**Status: Phase 0 complete (scaffolding).** The API is fully implemented but not
yet wired into the frontend. The app still runs in `local` mode, exactly as
before. See "What is not done yet" at the bottom.

---

## Why this exists

The frontend is a fully client-side app. That is fine for a demo, but it means
three things are currently readable by anyone who opens DevTools:

1. **Every answer.** `correctOption`, `explanation` and `hint` are bundled into
   the JS, and grading runs in the browser.
2. **The admin password.** `admin` / `admin123` is a literal in the source.
3. **The API keys.** `VITE_GEMINI_API_KEY` and `VITE_GROQ_API_KEY` are inlined
   into the client bundle by Vite.

This server moves all three behind an API that the browser cannot read past.

---

## Setup

### 1. Prerequisites

- Node.js 20+
- MongoDB 7+ running locally (`mongod` on 27017), or a hosted MongoDB Atlas URI

### 2. Install and configure

```powershell
npm install
Copy-Item .env.example .env
```

Edit `server/.env`:

```env
# Your local MongoDB. MONGODB_DB is a separate logical database, so DristiX never
# touches any of your other local databases.
MONGODB_URI="mongodb://127.0.0.1:27017"
MONGODB_DB="dristix"

# Must be at least 32 characters. Generate one with:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET="<paste a long random string>"

# Leave EMPTY for open registration in local dev.
# Set a code in production to make registration invite-only.
INVITE_CODES=""

# Move your real keys here from the root .env.local, then delete them there.
GEMINI_API_KEY=""
GROQ_API_KEY=""
```

The server refuses to start if `MONGODB_URI` or `JWT_SECRET` is missing or too
short. That is deliberate — a server that boots with a weak secret is worse than
one that refuses to boot.

> There is no migration step. MongoDB is schemaless, so the collections and
> their indexes are created by Mongoose on connect.

### 3. Seed

```powershell
npm run db:seed
```

The seed creates:

| Account | Credentials |
|---|---|
| Admin | `admin@dristix.local` / `admin123` |
| Student | `rohit@dristix.edu` / `student123` |
| Student | `ananya@dristix.edu` / `student123` |
| Student | `vikram@dristix.edu` / `student123` |

Plus the `SSC-CGL-01` exam with 4 questions.

Override them with `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and
`SEED_STUDENT_PASSWORD`.

### 4. Run

```powershell
npm run dev          # API on http://localhost:4000
```

Or from the project root, to run the frontend and API together:

```powershell
npm run dev:all
```

Check it is alive:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

---

## Using it from the frontend

The frontend picks its data source from an env flag. It defaults to `local`, so
**the app behaves exactly as it did before until you change it.**

```env
# .env.local (project root)
VITE_DATA_SOURCE=local     # default — offline, localStorage, no network
VITE_DATA_SOURCE=api       # talk to the backend
```

Vite proxies `/api` to `http://localhost:4000` in development, so the browser
makes same-origin requests and CORS never comes up.

---

## API reference

All routes are prefixed with `/api`. Everything except `/auth/*` and `/health`
requires `Authorization: Bearer <accessToken>`.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Invite-gated when `INVITE_CODES` is set |
| POST | `/auth/login` | Rate limited to 10 per 15 min |
| POST | `/auth/refresh` | Sets a new httpOnly refresh cookie |
| GET | `/auth/me` | Current profile |
| POST | `/auth/logout` | Clears the refresh cookie |

### Catalog
| Method | Path | Notes |
|---|---|---|
| GET | `/exams` | Published exams, no questions attached |
| GET | `/exams/:id` | Metadata and section names |

### Attempts
| Method | Path | Notes |
|---|---|---|
| POST | `/attempts` | Start or resume. Server sets `startedAt` / `expiresAt` |
| GET | `/attempts/:id/questions` | **Sanitised — no answer key** |
| PATCH | `/attempts/:id/state` | Autosave progress |
| POST | `/attempts/:id/heartbeat` | Server clock sync |
| POST | `/attempts/:id/submit` | **The only endpoint that returns answers** |
| GET | `/attempts` | Attempt history |

### Admin
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/exams` | All exams incl. unpublished |
| POST | `/admin/exams` | Create with questions and answer key |
| DELETE | `/admin/exams/:id` | Cascade deletes questions and attempts |
| GET | `/admin/submissions` | Every student's results |

### AI proxy
| Method | Path | Notes |
|---|---|---|
| POST | `/ai/chat` | Forwards to Gemini or Groq. Holds the keys |

---

## How the answer key stays private

This is the part worth reading carefully.

Questions are **embedded** in the exam document rather than stored in their own
collection. Two reasons: reading one question never needs a join, and deleting
an exam removes its answer keys in a single document delete.

`server/src/services/question.service.ts` exposes exactly two conversions:

- `toPublicQuestion(question, mode)` — strips `correctOption` and `explanation`.
  Includes `hint` only when `mode === 'practice'`.
- `toGradedQuestion(question, selected, mode)` — includes the answer key.

Every question-delivery route goes through the first. Only
`POST /attempts/:id/submit` uses the second. Sanitising happens by construction
in one function rather than by remembering to strip fields at each call site, so
a new endpoint cannot accidentally leak the key.

Three further guards:

1. **Grading is server-only.** `gradeAttempt()` in `grading.service.ts` is the
   only place scoring happens. The browser's own score is ignored.
2. **The server owns the clock.** `expiresAt` is set when the attempt is
   created. The client only renders a countdown and re-syncs on heartbeat, so
   editing client state cannot extend an exam and closing the tab does not reset
   it. A late submit is still graded but recorded as `expired`.
3. **Ownership is checked on every attempt route**, so one student cannot read
   or modify another's attempt.
4. **Exam and practice attempts never mix.** The live-attempt lookup is scoped
   by mode, so a student with a practice session open cannot have it resumed as
   a timed exam — which would otherwise hand them practice hints during a graded
   attempt.

### Verifying it yourself

```powershell
# Start an attempt, then:
Invoke-RestMethod -Method Post http://localhost:4000/api/attempts `
  -Headers @{ Authorization = "Bearer $TOKEN" } `
  -ContentType 'application/json' `
  -Body '{"examId":"<ID>","mode":"exam"}'
```

The response contains `questions` — check that none of them have a
`correctOption` or `explanation` field. In practice mode they will have `hint`,
but still no answers.

---

## Security notes

| Concern | Handling |
|---|---|
| Password storage | bcrypt, cost 12 |
| Brute force | 10 attempts / 15 min on credential routes |
| General abuse | 300 requests / min per IP |
| AI cost abuse | 30 requests / min per user in production |
| User enumeration | Login runs a dummy hash compare when the user is absent, so timing does not reveal whether an account exists |
| XSS | JSON only, `helmet` headers, no HTML rendering of user content |
| SQL injection | Prisma parameterises every query |
| Open registration | `INVITE_CODES` locks it down in production |
| Secrets | Never returned by any endpoint; they exist only in `server/.env` |

### Before deploying

1. Rotate the Gemini and Groq keys. The current ones were in the git-tracked
   `.env.example` and in `dist/`, so treat them as compromised.
2. Set `NODE_ENV=production` — this turns on `secure` cookies and tightens the
   AI rate limit.
3. Set a strong `JWT_SECRET`.
4. Set at least one `INVITE_CODES` value.
5. `npm --prefix server run build` and run `node dist/index.js`.
6. Optionally set `SERVE_STATIC=true` so the Express app also serves `dist/`,
   making the whole thing one deployable unit.

---

## What is not done yet

This is Phase 0. The API is complete and typechecks, but the frontend still
reads from `localStorage` because the stores have not been switched over yet.

| Phase | Status |
|---|---|
| 0 — scaffolding, adapter, bootstrap | Done |
| 1 — auth on the server, students/submissions in DB, AI proxy wired | Not started |
| 2 — exams in DB, answer key stripped, server grading | Server done, frontend not wired |
| 3 — server timer, autosave, crash recovery | Server done, frontend not wired |

So these are **still exposed in the current bundle**:

- `admin123` — `src/store/useAuthStore.ts:270`
- Seeded student emails — `src/store/useAuthStore.ts:36`
- API keys — `src/utils/geminiVoiceService.ts:10-11`

Phase 1 removes all three. The adapter in `src/services/dataSource/` is already
built and is what Phase 1 will switch the stores over to.
