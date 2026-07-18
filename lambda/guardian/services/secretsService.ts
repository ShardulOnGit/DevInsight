/**
 * @file lambda/guardian/services/secretsService.ts
 * @description Loads all credentials from Lambda environment variables.
 *
 * No AWS SDK calls. No Secrets Manager.
 * Values are set via SAM parameter_overrides in samconfig.toml.
 *
 * FIREBASE_PRIVATE_KEY must have literal \n characters to represent newlines
 * (e.g. "-----BEGIN RSA PRIVATE KEY-----\nMIIE..."). This function restores them.
 */

import type { FirebaseServiceAccount, SesConfig, Secrets } from '../types.ts';
import type { Result } from '../utils/result.ts';
import { ok, err } from '../utils/result.ts';

// ─── Module-level Cache (survives warm restarts) ──────────────────────────────

let cachedSecrets: Secrets | null = null;

// ─── Env Var Reader ───────────────────────────────────────────────────────────

function requireEnv(name: string): Result<string> {
  const val = process.env[name];
  if (!val || val === 'REPLACE_ME') {
    return err(new Error(`Missing required environment variable: ${name}`));
  }
  return ok(val);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads all required credentials from environment variables.
 *
 * - Synchronous after first call (warm start: returns cache instantly).
 * - Returns Result<Secrets> — caller handles missing vars gracefully.
 */
export async function loadSecrets(): Promise<Result<Secrets>> {
  if (cachedSecrets !== null) {
    return ok(cachedSecrets);
  }

  const projectIdResult     = requireEnv('FIREBASE_PROJECT_ID');
  const clientEmailResult   = requireEnv('FIREBASE_CLIENT_EMAIL');
  const privateKeyResult    = requireEnv('FIREBASE_PRIVATE_KEY');
  const groqApiKeyResult    = requireEnv('GROQ_API_KEY');

  if (!projectIdResult.ok)   return err(projectIdResult.error);
  if (!clientEmailResult.ok) return err(clientEmailResult.error);
  if (!privateKeyResult.ok)  return err(privateKeyResult.error);
  if (!groqApiKeyResult.ok)  return err(groqApiKeyResult.error);

  // Restore newlines — Lambda env vars can't contain literal newlines,
  // so the private key is stored with escaped \n sequences.
  const privateKey = privateKeyResult.value.replace(/\\n/g, '\n');

  const firebaseServiceAccount: FirebaseServiceAccount = {
    type: 'service_account',
    project_id: projectIdResult.value,
    private_key_id: '',
    private_key: privateKey,
    client_email: clientEmailResult.value,
    client_id: '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  };

  // SES is disabled in this deployment — ses config is a no-op placeholder
  const ses: SesConfig = {
    fromEmail: '',
    fromName: 'DevInsight Guardian',
    dashboardUrl: process.env['DASHBOARD_URL'] ?? 'https://devinsight.vercel.app',
  };

  cachedSecrets = {
    firebaseServiceAccount,
    groqApiKey: groqApiKeyResult.value,
    ses,
  };

  return ok(cachedSecrets);
}

/** Invalidates the secret cache. Call in tests between assertions. */
export function _clearSecretCache(): void {
  cachedSecrets = null;
}
