/**
 * @file lambda/guardian/types.ts
 * @description Lambda-specific types not present in shared/types.ts.
 *
 * Only Lambda runtime concerns live here: user records read from Firestore,
 * pipeline result shapes, secret schemas, and CloudWatch metric inputs.
 */

import type {
  ComputedMetrics,
  Decision,
  InsightData,
  ReportData,
} from '../../shared/types.ts';

// ─── Firestore User Record ─────────────────────────────────────────────────────

/**
 * Shape of a Firestore /users/{uid} document used by the Lambda.
 * Only fields needed by the Guardian pipeline are required here.
 */
export interface UserRecord {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string;
  readonly githubUsername: string;
  readonly githubAccessToken?: string;
}

// ─── Pipeline Result Types ────────────────────────────────────────────────────

/** Per-user result from processUser(). Collected into GuardianRunResult. */
export interface UserPipelineResult {
  readonly uid: string;
  readonly email: string;
  readonly activityCount: number;
  readonly insightCount: number;
  readonly reportStored: boolean;
  readonly emailSent: boolean;
  readonly durationMs: number;
  readonly error?: string;
}

/** Aggregate result returned by the Lambda handler. */
export interface GuardianRunResult {
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly usersProcessed: number;
  readonly usersSucceeded: number;
  readonly usersFailed: number;
  readonly insightsGenerated: number;
  readonly emailsSent: number;
  readonly errors: string[];
}

// ─── Secrets Schema ───────────────────────────────────────────────────────────

/**
 * Firebase service account JSON schema.
 * Matches the object returned from Firebase Console → Service Accounts.
 */
export interface FirebaseServiceAccount {
  readonly type: string;
  readonly project_id: string;
  readonly private_key_id: string;
  readonly private_key: string;
  readonly client_email: string;
  readonly client_id: string;
  readonly auth_uri: string;
  readonly token_uri: string;
}

/** SES configuration loaded from Secrets Manager. */
export interface SesConfig {
  readonly fromEmail: string;
  readonly fromName: string;
  /** Vercel deployment URL for the "Open Dashboard" CTA link in emails. */
  readonly dashboardUrl: string;
}

/** All secrets loaded at Lambda cold start. */
export interface Secrets {
  readonly firebaseServiceAccount: FirebaseServiceAccount;
  readonly groqApiKey: string;
  readonly ses: SesConfig;
}

// ─── CloudWatch Metric Inputs ─────────────────────────────────────────────────

/** Aggregate execution metrics emitted as CloudWatch custom metrics. */
export interface ExecutionMetrics {
  readonly durationMs: number;
  readonly usersProcessed: number;
  readonly insightsGenerated: number;
  readonly emailsSent: number;
  readonly failures: number;
  readonly groqFallbacks: number;
  readonly githubRateLimitHits: number;
}

// ─── Email Builder I/O ─────────────────────────────────────────────────────────

/** Parameters passed to emailBuilder.buildMorningBrief(). */
export interface EmailBuildParams {
  readonly user: UserRecord;
  readonly metrics: ComputedMetrics;
  readonly decision: Decision;
  readonly insights: ReadonlyArray<InsightData>;
  readonly report: ReportData;
  readonly dashboardUrl: string;
}

/** HTML + plain-text output from emailBuilder. */
export interface EmailContent {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** Parameters for ISesService.sendEmail(). */
export interface SendEmailParams {
  readonly to: string;
  readonly displayName: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}
