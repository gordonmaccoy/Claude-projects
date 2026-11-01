# OnScreen Test Mode: PostgreSQL setup (development branch)

This branch introduces durable storage for tests, sessions, student enrollment, and final submissions. It is **not production ready**.

## Setup
1. Provision a separate PostgreSQL instance for development (Railway PostgreSQL is suitable).
2. Set `DATABASE_URL` in the development service, not the live service.
3. Run `npm install` in `exam-monitor` to regenerate `package-lock.json` after adding `pg`, and commit the updated lockfile before deploying with `npm ci`.
4. Start the app. The database tables are created automatically on startup.
5. Test database restarts, duplicate submissions, network failures, and simultaneous student joins.

## Current limitations
- Tests and submissions are persisted, but **active sessions are not yet restored** after a server restart.
- Student identities and draft answers do not yet recover after reconnecting.
- Professor disconnection still terminates the active session.
- The professor dashboard still uses the 15-second permanent failure indicator.
- Session completion timestamps are not yet wired to all session-ending paths.
- Authentication and access controls for exam records are not implemented.
- Do not use this branch for real graded examinations until these gaps are addressed.

## Data model
- `onscreen_tests`: test title and complete answer key (server-side only)
- `onscreen_sessions`: test association and start/end timestamps
- `onscreen_students`: students by session and generated ID
- `onscreen_submissions`: one final submission per student per session, enforced by a database primary key

## Security
The database connection string is secret. Never commit it to GitHub or expose it in browser code.
