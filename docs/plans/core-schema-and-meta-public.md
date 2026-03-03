# Core: shared audit/soft-delete, meta public, initial enums

**Overview:** Add a shared audit/soft-delete schema module, make meta routing and docs explicitly public, remove personal workspace tables from the initial data model, and propose a minimal initial set of status/state enum values for CHECK constraints.

---

## 1. Shared schema helpers (Option A + soft-delete)

**New file:** `backend/src/core/db/schema/audit.ts`

- **`auditColumns()`** — returns the four columns used everywhere today:
  - `createdAt`, `updatedAt` (timestamp with TZ, not null, default now)
  - `createdBy`, `updatedBy` (text, nullable)
- **`softDeleteColumns()`** — returns two columns for soft-delete tables:
  - `deletedAt` — `timestamp('deleted_at', { withTimezone: true })` (nullable)
  - `deletedBy` — `text('deleted_by')` (nullable; stores display label, same semantics as `app_users.display_label`)

No FKs in the helpers; tables that need FKs (e.g. `publishedBy` on `form_version`) keep defining those columns explicitly.

**Schema files to update:**

- `backend/src/core/db/schema/core.ts` — Remove local `auditColumns()`. Import `auditColumns` from `./audit` and use it for all tables that currently spread it (identity_provider, app_user, user_identity, workspace, workspace_membership, workspace_group, workspace_group_membership).
- `backend/src/core/db/schema/forms.ts` — Remove local `strictAuditColumns()`. Import `auditColumns` and `softDeleteColumns` from `./audit`. For `form`, `form_version`, and `submission`: use `...auditColumns()`, `...softDeleteColumns()` and remove the inline `deletedAt`/`deletedBy` definitions. Change `deletedBy` from `uuid(...).references(appUsers.id)` to the text column provided by `softDeleteColumns()`. Leave `publishedBy` and `changedBy` as-is (still UUID refs to `app_users` for now).
- `backend/src/core/db/schema/plugins.enterprise.ts` — Remove local `auditColumns()`. Import `auditColumns` from `./audit`.
- `backend/src/core/db/schema/integration.ts` — Optionally refactor to use `auditColumns()` from `./audit` instead of inline createdAt/updatedAt/createdBy/updatedBy for consistency.

**Repos (deletedBy value):** In `formRepo.ts`, `formVersionRepo.ts`, and `submissionRepo.ts`, in each `mark*Deleted` function set `deletedBy: actorDisplayLabel` (not `actorId`). Signatures can stay `(..., actorId, actorDisplayLabel)` for consistency with other callers.

---

## 2. Make /meta public (routing and docs)

**Current behavior:** In `backend/src/app.ts`, meta is already mounted **before** the core router:

- `app.use('/api/v1/meta', express.json(), metaRouter);` — no JWT, no actor, no core context.
- `app.use('/api/v1', express.json(), checkJwt(), resolveActor, coreRouter);` — only non-meta paths under `/api/v1` hit this (forms at `/`, submissions at `/submissions`).

So meta is already public at the app level. The gap is clarity in core and in docs.

**Code:**

- `backend/src/core/api/index.ts` — Add a short comment that meta is mounted at app level at `/api/v1/meta` and is public (no JWT/core context). Keep including `metaDomain` in `coreDomains` only for OpenAPI registration; do not mount `metaDomain.router` on this router (it is not in `authenticatedDomains` today, so it is not mounted here—confirm and document).

**Documentation:**

- `docs/core-overview.md` — In "API" and "Where to find things", state explicitly that meta endpoints are **public** (no auth) and mounted at `/api/v1/meta` at app level; forms and submissions are under `/api/v1` with JWT and core context.
- `docs/core-deep-dive.md` — In the API section, state that meta is public and mounted separately at `/api/v1/meta` (no JWT, no core context); forms and submissions require JWT and core context and are mounted on the core router.

No middleware changes are required; routing already makes meta public.

---

## 3. Initial status/state enum values (suggested minimal set)

These align with `backend/src/core/db/schema/types.ts` and current usage. You can trim or extend before adding CHECKs.

| Type                            | Suggested initial values                            | Used in                                                        |
| ------------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| **FormStatus**                  | `'active'`, `'archived'`, `'deleted'`               | form.status                                                    |
| **FormVersionState**            | `'draft'`, `'published'`, `'deleted'`               | form_version.state                                             |
| **FormVersionEngineSyncStatus** | `'pending'`, `'provisioning'`, `'ready'`, `'error'` | form_version.engine_sync_status, submission.engine_sync_status |
| **OutboxStatus**                | `'pending'`, `'processing'`, `'done'`               | integration_outbox.status                                      |
| **WorkspaceMembershipStatus**   | `'active'`, `'inactive'`, `'pending'`               | workspace_membership.status                                    |
| **WorkspaceMembershipRole**     | `'owner'`, `'admin'`, `'member'`, `'viewer'`        | workspace_membership.role                                     |
| **Workspace kind**              | `'personal'`, `'enterprise'`                        | workspace.kind (if you want to constrain it)                    |

**Recommendation:** Start with this minimal set. Add CHECK constraints in Drizzle only after you confirm the set (e.g. in a follow-up), so the schema stays the single source of truth. No code edits in this plan for CHECKs—only the suggestion above so you can decide the initial set.

---

## 4. Remove personal workspace tables

The initial data model will not include personal-plugin tables (settings, invites, audit). The **personal-local plugin** (workspace resolver and API under `backend/src/plugins/personal-local/`) stays; only the **DB tables** and the repo that used them are removed. Personal workspaces (e.g. `workspace.kind = 'personal'`) remain; we are just not modelling settings/invites/audit yet.

**Schema and repo:**

- Delete `backend/src/core/db/schema/plugins.personal.ts` (tables: `personal_workspace_settings`, `personal_invite`, `personal_audit`).
- Remove the `export * from './plugins.personal';` line from `backend/src/core/db/schema/index.ts`.
- Delete `backend/src/core/db/repos/plugins/personalSettingsRepo.ts`. No other code imports `getPersonalWorkspaceSettings`.

**Documentation:**

- `docs/datamodel.md` — Remove personal tables from the overview, ERD (Plugins: personal and enterprise), table list, and "What is not modelled" (drop or reword the personal placeholder sentence). Leave enterprise plugin tables as-is.
- `docs/core-overview.md` — In "Personal vs enterprise", remove or soften "invites/settings/audit via the personal plugin". In "Where to find things" (Repos row), remove "personal settings" from the plugin repos example (e.g. "enterprise bindings" only).
- `docs/core-deep-dive.md` — In "Why personal vs enterprise", remove or soften the sentence that says invites/settings/audit are "handled by the personal plugin (tables: …)". In "Schema files" and "Repos", remove references to `plugins.personal.ts` and `personalSettingsRepo` / `getPersonalWorkspaceSettings`.

**Tests:** No test file imports the personal schema or personalSettingsRepo. Config tests that reference `personal-local` are about the workspace plugin name, not the tables; leave them as-is.

---

## 5. Schema index and migrations

- `backend/src/core/db/schema/index.ts` — Remove export of `plugins.personal` (see section 4). The new `audit.ts` is only imported by other schema files, not re-exported from index.
- After all schema changes, run `npm run db:generate` once to produce a clean initial migration (you have deleted the old drizzle schema).

---

## Summary

| Area              | Action                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit/soft-delete | Add `audit.ts` with `auditColumns()` and `softDeleteColumns()`; switch core, forms, plugins.enterprise (and optionally integration) to use them; `deletedBy` becomes text; repos set `deletedBy: actorDisplayLabel`.      |
| Meta public       | Document in core-overview and core-deep-dive that meta is public and mounted at `/api/v1/meta`; add a brief comment in core api/index. No routing/middleware change.                                                     |
| Enums             | Suggest minimal initial values above; defer CHECK constraints until the set is confirmed.                                                                                                                               |
| Personal tables   | Delete `plugins.personal.ts` schema, `personalSettingsRepo.ts`, and schema index export; update datamodel.md, core-overview.md, and core-deep-dive.md to remove personal table references. personal-local plugin unchanged. |
