# Morocco Telecom Field ERP

Premium ERP-lite web application for Moroccan telecom field operations.

## Stack

- Next.js App Router, React, TypeScript
- PostgreSQL with Prisma ORM
- NextAuth credentials authentication
- Strict least-privilege role-based access control
- Audit logs, approvals, cash controls
- Excel/PDF export endpoints

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`
3. Create a PostgreSQL database and update `DATABASE_URL`
4. Set `DIRECT_URL` to the same local database URL
5. Run `npm run db:migrate`
6. Seed demo data with `npm run db:seed`
7. Start with `npm run dev`

Default seed password for all demo users:

- `ChangeMe123!`

Demo users:

- Email: `boss@telecom.local`
- Email: `gm@scadacom.local`
- Email: `pm1@scadacom.local`
- Email: `pm2@scadacom.local`
- Email: `pm3@scadacom.local`
- Email: `finance1@scadacom.local`
- Email: `finance2@scadacom.local`
- Email: `leader@scadacom.local`
- Email: `tech@scadacom.local`
- Email: `warehouse@scadacom.local`
- Email: `fleet@scadacom.local`

Change this immediately before real use.

Default Boss Room passcode after seed/security setup:

- `0000`

Change this before production. Boss Room is visible only when `user.role = BOSS` and `user.email` matches `BOSS_EMAIL`.

## Access model

- No public registration.
- Users are created by one-time expiring invites.
- Invite role is locked and cannot be changed during signup.
- Project Manager invites require assigned projects.
- Project Managers only see assigned projects.
- Financial Department sees financial modules but not Boss Profit Room.
- Technicians and Team Leaders use the limited technician app.
- Boss Profit Room returns 404 for anyone except the configured Boss identity.

## Deployment readiness

Use PostgreSQL for live testing. Neon, Supabase, Railway, Render, or Vercel Postgres are all acceptable for a test model.

Required environment variables:

- `DATABASE_URL`: pooled PostgreSQL connection string used by the app.
- `DIRECT_URL`: direct PostgreSQL connection string used by Prisma migrations.
- `AUTH_SECRET`: random 32-byte base64 secret for Auth.js.
- `AUTH_URL`: deployed app URL, for example `https://scadacom-test.vercel.app`.
- `NEXTAUTH_SECRET`: same value as `AUTH_SECRET` for compatibility.
- `NEXTAUTH_URL`: same value as `AUTH_URL` for compatibility.
- `BOSS_EMAIL`: boss identity allowed to see Boss Profit Room.
- `BOSS_ROOM_PASSCODE_HASH`: bcrypt hash used by seed to initialize the secondary Boss Room passcode.
- `UPLOAD_DIR`: local upload folder. Use `/tmp/uploads` on Vercel test deployments.

Generate secrets:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "require('bcryptjs').hash('0000',12).then(console.log)"
```

Production build command:

```powershell
npm run vercel-build
```

This runs:

```text
prisma generate && prisma migrate deploy && next build
```

After deployment, run the seed once against the live test database from a trusted local terminal:

```powershell
npm run db:seed
```
