# Production QA Checklist

## Scope

Stability pass focused on server exceptions, route loading, approval flows, notifications, and safe fallbacks. No new business features were added.

## Routes Checked

- `/dashboard`
- `/projects`
- `/projects/[id]`
- `/missions`
- `/teams`
- `/employees`
- `/technician`
- `/advances`
- `/purchases`
- `/expenses`
- `/allowances`
- `/cash`
- `/suppliers`
- `/taxes`
- `/warehouse`
- `/fleet`
- `/reports`
- `/boss-room`
- `/boss`
- `/settings`
- `/audit-history`
- `/audit`

Run automated unauthenticated route smoke check with:

```bash
npm run qa:routes
```

Use `QA_BASE_URL=https://scadacom-erp-test.onrender.com npm run qa:routes` to check production for 5xx responses.

## Actions Reviewed

- Advance submit, approve, reject, partially approve
- Purchase submit, approve, reject, partially approve
- Expense submit, approve, reject, partially approve
- Cash movement creation
- Vehicle creation/update
- Mission creation and vehicle assignment
- Notification polling, badge counts, mark-read APIs
- Boss Room report generation/locking and assistant route access

## Issues Fixed

- Boss approval was incorrectly treated as an override because the check used the requested new status instead of the existing record status.
- Approval actions now validate entity/status, missing record, project access, and previously reviewed records.
- Approval side effects now revalidate the specific affected list page.
- Audit logging failures no longer break business actions.
- Notification creation and badge count failures no longer break page rendering.
- Notification center API now returns a safe empty state instead of throwing if notification sync fails.
- Notification bell polling now handles fetch/runtime errors client-side.
- `/advances`, `/purchases`, and `/expenses` no longer rely on required project relation hydration for list rendering.
- Added friendly global error and not-found pages.
- Added `/boss` and `/audit` aliases to the existing Boss Room and Audit History routes.

## Remaining Risks

- Render stack traces require access to the authenticated Render dashboard logs or Render API credentials.
- The route smoke script checks for 5xx responses, but it cannot validate authenticated data states unless run with a logged-in browser or test session cookie.
- Deep form testing still requires interactive test users for every role.
