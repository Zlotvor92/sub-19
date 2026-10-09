# Database changes and backups

`migrations/` is the authoritative schema history. The first migration adopts the existing production schema without recreating objects; on a fresh Supabase project it installs the audited baseline. Older top-level SQL scripts are historical setup references: do not rerun them over the migrated database because they can restore obsolete grants.

Deploy order: baseline, data_integrity_and_ai_quota, new API, then ai_server_write_access. The last step removes client writes to AI jobs. Existing completed analyses remain readable. Server RPC opens a job and charges its quota atomically; only service_role can call it. The API chooses the authenticated UID and retains the owner's existing limit. Protected superadmin deletion routines are not modified on an existing project.

Run isolated PostgreSQL migration/RLS tests with `npm ci --prefix supabase/tests` and `npm test --prefix supabase/tests`. They never connect to production.

## Offsite backup setup

The workflow `.github/workflows/database-backup.yml` exports a custom-format PostgreSQL archive, verifies its table of contents, encrypts it with AES256, checks decryption, and retains only the encrypted artifact for 30 days. It runs daily at 03:20 UTC and can be triggered manually. It is **not operational until both GitHub Actions secrets are set**:

- `SUPABASE_DB_URL`: PostgreSQL connection string from Supabase Connect (session pooler port 5432 for IPv4 if direct connection is unavailable). Use a dedicated backup login with read access to the required schemas, or the existing database administrator connection. Never use the HTTP anon/service-role API key as a database password.
- `SUPABASE_BACKUP_PASSPHRASE`: long random passphrase; retain it separately from GitHub. Losing it makes backups unreadable.

Do not commit exports or passwords. GitHub project administrators can trigger workflows and access these secrets through workflow code; protect workflow edits and repository access. The workflow fails explicitly if credentials are absent.

This archive covers database schemas/data the database login can read (including Auth metadata when permitted), not Storage object contents, provider secrets, JWT configuration or external OAuth tokens/settings. Storage currently has no buckets. Restore into an isolated Supabase project, following Supabase's documented managed-schema restore procedure; test login and application sync before considering it a verified disaster-recovery backup. Archive/decryption checks alone do not prove a complete restore. Keep at least one copy outside GitHub and perform periodic restore drills.

## Race analysis

Race context and AI results live under the extensible `log[id].raceAi` namespace. Existing training analyses and log fields are retained; no root schema version change is needed. In the app, open Napredak → Analiza trke, select any completed run, enter official distance/time and intent, save context, then analyze. Manual races are stored as completed run records. Race results never automatically recalibrate VDOT or modify the plan.
