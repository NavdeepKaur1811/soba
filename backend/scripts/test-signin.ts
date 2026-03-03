/**
 * Test sign-in flow: call the backend with a real IdP token, then verify that
 * the expected records exist in the database (identity_provider, app_user,
 * user_identity, personal workspace with user in owners group, and soba_admin if applicable).
 *
 * Usage:
 *   # GitHub (token from gh auth token or a PAT)
 *   SOBA_TEST_TOKEN=$(gh auth token) npm run script:test-signin
 *   # or
 *   SOBA_TEST_TOKEN=ghp_xxx npm run script:test-signin -- --idp=github
 *
 *   # BC Gov SSO (JWT from your dev realm)
 *   SOBA_TEST_TOKEN=eyJ... npm run script:test-signin -- --idp=bcgov-sso
 *
 *   # Base URL (default http://localhost:4000)
 *   SOBA_API_BASE_URL=http://localhost:4000 npm run script:test-signin
 *
 * Requires: backend running, DATABASE_URL set, and a valid token for one of
 * the enabled IdPs (bcgov-sso, idp-github).
 */
import { and, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../src/core/db/client';
import { Roles } from '../src/core/db/codes';
import {
  appUsers,
  identityProviders,
  sobaAdmins,
  userIdentities,
  workspaceGroupMemberships,
  workspaceGroups,
  workspaceMemberships,
  workspaces,
} from '../src/core/db/schema';

const API_BASE = process.env.SOBA_API_BASE_URL || 'http://localhost:4000';
const TOKEN =
  process.env.SOBA_TEST_TOKEN || process.argv.find((a) => a.startsWith('--token='))?.slice(8);

type IdpKind = 'github' | 'bcgov-sso';

function parseIdp(): IdpKind {
  const arg = process.argv.find((a) => a.startsWith('--idp='));
  const val = arg?.slice(6)?.toLowerCase();
  if (val === 'bcgov-sso' || val === 'bcgov') return 'bcgov-sso';
  return 'github';
}

async function getExpectedFromGitHub(
  token: string,
): Promise<{ subject: string; providerCode: string; displayLabel?: string }> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text || res.statusText}`);
  }
  const user = (await res.json()) as { id?: number; login?: string; name?: string | null };
  const subject = user.id != null ? String(user.id) : (user.login && String(user.login)) || '';
  const displayLabel = user.login || (user.name && String(user.name)) || subject;
  return { subject, providerCode: 'github', displayLabel };
}

function getExpectedFromBcgovJwt(token: string): {
  subject: string;
  providerCode: string;
  displayLabel?: string;
} {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid JWT: could not decode');
  }
  const payload = decoded as Record<string, unknown>;
  const sub = payload.sub;
  const subject = typeof sub === 'string' ? sub : typeof sub === 'number' ? String(sub) : '';
  const idp =
    typeof payload.identity_provider === 'string'
      ? payload.identity_provider
      : typeof (payload as Record<string, unknown>).idpType === 'string'
        ? ((payload as Record<string, unknown>).idpType as string)
        : 'idir';
  const providerCode = idp.toLowerCase();
  const displayLabel =
    (typeof (payload as Record<string, unknown>).idir_username === 'string' &&
      (payload as Record<string, unknown>).idir_username) ||
    (typeof (payload as Record<string, unknown>).bceid_username === 'string' &&
      (payload as Record<string, unknown>).bceid_username) ||
    (typeof (payload as Record<string, unknown>).email === 'string' &&
      (payload as Record<string, unknown>).email) ||
    (typeof (payload as Record<string, unknown>).preferred_username === 'string' &&
      (payload as Record<string, unknown>).preferred_username) ||
    subject;
  return { subject, providerCode, displayLabel: displayLabel as string };
}

async function callSignIn(
  token: string,
): Promise<{ ok: boolean; status: number; body: unknown; text: string }> {
  const res = await fetch(`${API_BASE}/api/v1/forms`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  const body = (() => {
    try {
      return text ? (JSON.parse(text) as unknown) : {};
    } catch {
      return { raw: text };
    }
  })();
  return { ok: res.ok, status: res.status, body, text };
}

async function verifyDbRecords(
  providerCode: string,
  subject: string,
  expectedDisplayLabel?: string,
) {
  const normalizedProvider = providerCode.toLowerCase();

  const providerRow = await db
    .select()
    .from(identityProviders)
    .where(eq(identityProviders.code, normalizedProvider))
    .limit(1);
  const provider = providerRow[0];
  if (!provider) {
    return { ok: false, message: `Missing identity_provider with code=${normalizedProvider}` };
  }

  const identityRow = await db
    .select()
    .from(userIdentities)
    .where(
      and(
        eq(userIdentities.identityProviderCode, provider.code),
        eq(userIdentities.subject, subject),
      ),
    )
    .limit(1);
  const identity = identityRow[0];
  if (!identity) {
    return {
      ok: false,
      message: `Missing user_identity for provider=${normalizedProvider}, subject=${subject}`,
    };
  }

  const userRow = await db.select().from(appUsers).where(eq(appUsers.id, identity.userId)).limit(1);
  const user = userRow[0];
  if (!user) {
    return { ok: false, message: `Missing app_user for user_id=${identity.userId}` };
  }

  if (expectedDisplayLabel != null && user.displayLabel !== expectedDisplayLabel) {
    return {
      ok: false,
      message: `app_user.display_label mismatch: expected "${expectedDisplayLabel}", got "${user.displayLabel}"`,
    };
  }

  // Require personal workspace with user in owners group (ensureHomeWorkspace creates these on first sign-in)
  const personalWithOwnerGroup = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      kind: workspaces.kind,
      membershipId: workspaceMemberships.id,
      membershipRole: workspaceMemberships.role,
      membershipSource: workspaceMemberships.source,
      ownersGroupId: workspaceGroups.id,
      ownersGroupName: workspaceGroups.name,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .innerJoin(
      workspaceGroupMemberships,
      and(
        eq(workspaceGroupMemberships.workspaceMembershipId, workspaceMemberships.id),
        eq(workspaceGroupMemberships.workspaceId, workspaces.id),
      ),
    )
    .innerJoin(
      workspaceGroups,
      and(
        eq(workspaceGroups.id, workspaceGroupMemberships.groupId),
        eq(workspaceGroups.workspaceId, workspaces.id),
        eq(workspaceGroups.roleCode, Roles.workspace_owner),
      ),
    )
    .where(
      and(
        eq(workspaceMemberships.userId, user.id),
        eq(workspaceMemberships.status, 'active'),
        eq(workspaces.kind, 'personal'),
        eq(workspaceGroupMemberships.status, 'active'),
      ),
    )
    .limit(5);

  if (personalWithOwnerGroup.length === 0) {
    return {
      ok: false,
      message:
        'Missing personal workspace with user in owners group (ensureHomeWorkspace should create these on first sign-in)',
    };
  }

  // SOBA admin: optional; report if user is in soba_admin table
  const adminRow = await db
    .select({
      userId: sobaAdmins.userId,
      source: sobaAdmins.source,
      identityProviderCode: sobaAdmins.identityProviderCode,
    })
    .from(sobaAdmins)
    .where(eq(sobaAdmins.userId, user.id))
    .limit(1);
  const sobaAdmin = adminRow[0] ?? null;

  return {
    ok: true,
    provider,
    identity,
    user,
    personalWorkspace: personalWithOwnerGroup[0],
    sobaAdmin,
  };
}

async function main() {
  if (!TOKEN) {
    console.error('Missing token. Set SOBA_TEST_TOKEN or pass --token=YOUR_TOKEN');
    process.exit(1);
  }

  const idp = parseIdp();
  console.log(`IdP: ${idp}`);
  console.log(`API base: ${API_BASE}`);
  console.log('');

  let expected: { subject: string; providerCode: string; displayLabel?: string };
  try {
    if (idp === 'github') {
      expected = await getExpectedFromGitHub(TOKEN);
    } else {
      expected = getExpectedFromBcgovJwt(TOKEN);
    }
  } catch (e) {
    console.error('Failed to get expected identity from token:', (e as Error).message);
    process.exit(1);
  }

  console.log('Expected after sign-in:', expected);
  console.log('');

  const signInResult = await callSignIn(TOKEN);
  if (!signInResult.ok) {
    const errBody =
      signInResult.body && typeof signInResult.body === 'object' && 'error' in signInResult.body
        ? (signInResult.body as { error: string }).error
        : signInResult.text || JSON.stringify(signInResult.body);
    console.error('Sign-in request failed:', signInResult.status, errBody);
    if (signInResult.status === 500) {
      console.error(
        'Tip: ensure migrations are applied (npm run db:migrate) and seed run (npm run db:seed); soba_admin and role tables must exist.',
      );
    }
    process.exit(1);
  }
  console.log('Sign-in request succeeded (HTTP', signInResult.status, ')');
  console.log('');

  const verify = await verifyDbRecords(
    expected.providerCode,
    expected.subject,
    expected.displayLabel,
  );
  if (!verify.ok) {
    console.error('DB verification failed:', verify.message);
    process.exit(1);
  }

  console.log('DB verification passed:');
  console.log('  identity_provider: code=', verify.provider!.code);
  console.log(
    '  user_identity:    subject=',
    verify.identity!.subject,
    ', user_id=',
    verify.identity!.userId,
  );
  console.log(
    '  app_user:         id=',
    verify.user!.id,
    ', display_label=',
    verify.user!.displayLabel,
  );
  const pw = verify.personalWorkspace!;
  console.log('  personal workspace:', pw.workspaceName, `(${pw.kind})`, pw.workspaceId);
  console.log(
    '    membership:     role=',
    pw.membershipRole,
    ', source=',
    pw.membershipSource,
    ', id=',
    pw.membershipId,
  );
  console.log(
    '    owners group:   ',
    pw.ownersGroupName,
    '(role_code=workspace_owner)',
    pw.ownersGroupId,
  );
  if (verify.sobaAdmin) {
    const idpPart = verify.sobaAdmin.identityProviderCode
      ? `, idp=${verify.sobaAdmin.identityProviderCode}`
      : '';
    console.log('  soba_admin:        yes (source=', verify.sobaAdmin.source, idpPart, ')');
  } else {
    console.log('  soba_admin:        no');
  }
  console.log('');
  console.log(
    'Done. Expected records are present (identity, user, personal workspace + owner group, admin status).',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
