# SCADACOM ERP Production Runbook

## Daily Checks

- Open `/dashboard` and confirm the app loads without a server exception.
- Open `/advances`, `/expenses`, and `/purchases`; confirm pending approvals show correctly.
- Check the notification bell and sidebar badges.
- Check Render deploy status after every push.

## Weekly Checks

- Run route smoke checks:

```bash
npm run qa:routes
```

- Run translation key checks:

```bash
npm run i18n:check
```

- Review Boss Room red flags and audit history.
- Verify at least one Boss, GM, PM, Finance, Technician, Warehouse, and Fleet user can log in.

## Database Backup

Create a local PostgreSQL backup:

```bash
npm run backup:db
```

By default, backups are written to `backups/`. Keep at least:

- Daily backups for 14 days
- Monthly backups for 24 months
- Yearly backups for long-term archive

Copy important backups to an external drive or trusted cloud storage.

## Database Restore Drill

Only restore into a test database first.

```bash
$env:RESTORE_CONFIRM="RESTORE"
$env:BACKUP_FILE="backups/scadacom-db-example.dump"
npm run restore:db
```

Never restore over production without confirming:

- Correct target database URL
- Latest production backup exists
- Boss approval
- Maintenance window

## Uploaded Files

Back up uploaded receipts, invoices, survey images, and project documents separately from the database.

Recommended:

- Keep production uploads in durable storage.
- Copy the `uploads/` folder to external storage weekly if using local disk.
- Keep file metadata in the database so deleted/replaced files remain auditable.

## Production Deployment Checklist

Before pushing:

```bash
npm run i18n:check
npm run build
```

After Render deploy:

- Open `/login`
- Log in as Boss
- Open `/dashboard`
- Open `/boss-room`
- Test one approval flow on a safe test request

## Incident Checklist

If a user sees an application error:

1. Record the URL, user role, and action they performed.
2. Copy the digest number from the error page.
3. Check Render logs for the matching stack trace.
4. Confirm whether the issue affects all users or one role.
5. Fix root cause locally.
6. Run `npm run build`.
7. Push and verify the route after deploy.
