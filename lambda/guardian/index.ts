/**
 * @file lambda/guardian/index.ts
 * @description DevInsight Guardian — Autonomous AI Engineering Manager.
 *
 * This file contains ONLY orchestration. All business logic lives in shared/.
 * Service I/O lives in services/. This handler is responsible for:
 *   1. Initializing dependencies on cold start.
 *   2. Running the 8-stage pipeline for each active user.
 *   3. Aggregating results and writing the audit run log.
 *   4. Emitting CloudWatch metrics.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  8-STAGE AUTONOMOUS PIPELINE                                        │
 * │                                                                     │
 * │  ① OBSERVE  → Load all GitHub-connected users from Firestore        │
 * │  ② ANALYZE  → Fetch GitHub events; fall back to simulated on error  │
 * │  ③ REASON   → Compute metrics (productivity, burnout, trend)        │
 * │  ④ DECIDE   → Filter noise, prioritize, apply agent memory          │
 * │  ⑤ PLAN     → Build Decision-aware prompt; call Groq for coaching   │
 * │  ⑥ NOTIFY   → Render HTML email brief; send via SES                 │
 * │  ⑦ STORE    → Batch-write activities, insights, report, memory      │
 * │  ⑧ AUDIT    → Write GuardianRun log; emit CloudWatch metrics        │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Error strategy:
 *   - Secrets failure is fatal (cannot proceed without credentials).
 *   - Per-user failures are isolated: one user's error does not abort others.
 *   - Groq / SES failures have fallbacks and are non-fatal.
 *   - Metrics failure is logged only; never aborts.
 *   - The handler always returns a GuardianRunResult, never throws.
 */

import type { ScheduledEvent } from 'aws-lambda';

// ── Shared business logic (no I/O, no SDK) ──────────────────────────────────
import { computeMetrics } from '../../shared/metrics.ts';
import { decide } from '../../shared/decisions.ts';
import { buildMemoryUpdate } from '../../shared/memory.ts';
import {
  processGitHubEvents,
  generateSimulatedEvents,
} from '../../shared/github.ts';

// ── Service layer ─────────────────────────────────────────────────────────────
import { loadSecrets } from './services/secretsService.ts';
import { createFirestoreService } from './services/firestoreService.ts';
import { createGitHubService, GitHubRateLimitError } from './services/githubService.ts';
import { createGroqService } from './services/groqService.ts';
import { createSesService } from './services/sesService.ts';
import { createCloudWatchService } from './services/cloudwatchService.ts';
import { buildMorningBrief } from './services/emailBuilder.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
import type {
  UserRecord,
  UserPipelineResult,
  GuardianRunResult,
  ExecutionMetrics,
  EmailBuildParams,
} from './types.ts';
import type {
  IFirestoreService,
} from './services/firestoreService.ts';
import type { IGitHubService } from './services/githubService.ts';
import type { IGroqService } from './services/groqService.ts';
import type { ISesService } from './services/sesService.ts';
import type { ICloudWatchService } from './services/cloudwatchService.ts';

// ── Utilities ─────────────────────────────────────────────────────────────────
import { StructuredLogger, StageTimer } from './utils/logger.ts';
import { getOrElse } from './utils/result.ts';

// ─── Service Container ────────────────────────────────────────────────────────

/** All services injected into processUser() — makes each stage unit-testable. */
interface ServiceContainer {
  readonly firestore: IFirestoreService;
  readonly github: IGitHubService;
  readonly groq: IGroqService;
  readonly ses: ISesService;
  readonly cloudwatch: ICloudWatchService;
  readonly dashboardUrl: string;
}

// ─── Run ID ───────────────────────────────────────────────────────────────────

function generateRunId(): string {
  const now = new Date();
  const ts = now
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14); // "20260718023000"
  return `guardian-${ts}`;
}

// ─── Per-User Pipeline ────────────────────────────────────────────────────────

/**
 * Runs the full 7-stage pipeline for a single user.
 * Failures at any stage are logged and isolated — never propagated to handler level.
 *
 * @param user - The user record from Firestore (OBSERVE stage output)
 * @param deps - Injected service container
 * @returns    - A structured summary of what happened for this user
 */
async function processUser(
  user: UserRecord,
  deps: ServiceContainer,
  logger: StructuredLogger,
): Promise<UserPipelineResult> {
  const timer = new StageTimer();

  // ─── ① OBSERVE: load agent memory ─────────────────────────────────────────
  logger.stageStart('OBSERVE', user.uid);
  const memoryResult = await deps.firestore.getAgentMemory(user.uid);
  const memory = memoryResult.ok ? memoryResult.value : null;

  if (!memoryResult.ok) {
    logger.warn('OBSERVE', {
      event: 'MEMORY_LOAD_FAILED',
      reason: memoryResult.error.message,
      fallback: 'proceeding without memory context',
    }, user.uid);
  }
  logger.stageEnd('OBSERVE', timer.lap(), { memoryFound: memory !== null }, user.uid);

  // ─── ② ANALYZE: fetch GitHub events ───────────────────────────────────────
  logger.stageStart('ANALYZE', user.uid);
  let githubRateLimitHit = false;

  const eventsResult = await deps.github.fetchEvents(
    user.githubUsername,
    user.githubAccessToken,
  );

  // getOrElse already provides the simulated fallback; log the failure separately
  const eventsSource = eventsResult.ok ? 'github_api' : 'simulated';
  if (!eventsResult.ok) {
    githubRateLimitHit = eventsResult.error instanceof GitHubRateLimitError;
    logger.warn('ANALYZE', {
      event: githubRateLimitHit ? 'GITHUB_RATE_LIMITED' : 'GITHUB_FETCH_FAILED',
      reason: eventsResult.error.message,
      fallback: 'simulated_events',
    }, user.uid);
  }

  const rawEvents = getOrElse(eventsResult, generateSimulatedEvents(user.githubUsername));

  const { activityByDay, recentRepos } = processGitHubEvents(rawEvents, user.uid);
  const activities = Object.values(activityByDay);

  logger.stageEnd('ANALYZE', timer.lap(), {
    source: eventsSource,
    eventCount: rawEvents.length,
    activityDays: activities.length,
    rateLimitHit: githubRateLimitHit,
    topRepo: recentRepos[0]?.repoName ?? null,
  }, user.uid);

  // ─── ③ REASON: compute metrics ────────────────────────────────────────────
  logger.stageStart('REASON', user.uid);
  const metrics = computeMetrics(activities);
  logger.stageEnd('REASON', timer.lap(), {
    productivityScore: metrics.productivityScore,
    burnoutRisk: metrics.burnoutRiskStatus,
    totalCommits: metrics.totalCommits,
    activeDays: metrics.activeDays,
    consistency: metrics.consistency,
    nextWeekPctChange: metrics.nextWeekPctChange,
  }, user.uid);

  // ─── ④ DECIDE: agent reasoning ────────────────────────────────────────────
  logger.stageStart('DECIDE', user.uid);
  const topRepo = recentRepos[0]?.repoName ?? null;
  const decision = decide(metrics, memory, topRepo);

  logger.stageEnd('DECIDE', timer.lap(), {
    focus: decision.focus,
    urgency: decision.urgency,
    recommendationCount: decision.recommendations.length,
    strategyShift: decision.strategyShift,
    hasAcknowledgement: decision.acknowledgement !== null,
    ignoredIssueCount: decision.ignoredIssues.length,
    topRecommendationPriority: decision.recommendations[0]?.priority ?? null,
    topRecommendationCategory: decision.recommendations[0]?.category ?? null,
  }, user.uid);

  // ─── ⑤ PLAN: generate insights and report via Groq ────────────────────────
  logger.stageStart('PLAN', user.uid);

  // Run insights and report generation in parallel to reduce latency
  const [insightsResult, reportResult] = await Promise.all([
    deps.groq.generateInsights(metrics, decision),
    deps.groq.generateReport(metrics, decision),
  ]);

  // Both use internal fallbacks, so these are always ok() after groqService
  const insights = getOrElse(insightsResult, []);
  const report = getOrElse(reportResult, {
    summaryText: '',
    headline: 'Weekly Performance Summary',
    keyWin: '',
    keyRisk: '',
    productivityScore: metrics.productivityScore,
    burnoutRiskStatus: metrics.burnoutRiskStatus,
    nextWeekForecast: 'Stable',
    nextWeekPctChange: metrics.nextWeekPctChange,
    weekEnding: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
  });

  logger.stageEnd('PLAN', timer.lap(), {
    insightCount: insights.length,
    insightsOk: insightsResult.ok,
    reportOk: reportResult.ok,
    groqFallbackUsed: !insightsResult.ok || !reportResult.ok,
  }, user.uid);


  // ─── ⑥ NOTIFY: render and send morning brief ──────────────────────────────
  logger.stageStart('NOTIFY', user.uid);

  // Type-cast is safe: insights from GroqService always have all required fields
  const insightDocuments = insights.map(i => ({
    uid: user.uid,
    ...i,
  }));

  const reportDocument = {
    uid: user.uid,
    ...report,
  };

  const emailParams: EmailBuildParams = {
    user,
    metrics,
    decision,
    insights: insightDocuments,
    report: reportDocument,
    dashboardUrl: deps.dashboardUrl,
  };

  const emailContent = buildMorningBrief(emailParams);

  // EMAIL_ENABLED=false skips SES entirely — email content is still built
  // so the dashboard can display the morning brief via Firestore.
  const emailEnabled = process.env['EMAIL_ENABLED'] !== 'false';
  let emailSent = false;
  const notifyDurationMs = timer.lap();

  if (emailEnabled) {
    const emailResult = await deps.ses.sendEmail({
      to: user.email,
      displayName: user.displayName,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
    emailSent = emailResult.ok;
    if (!emailResult.ok) {
      logger.error('NOTIFY', emailResult.error, { event: 'EMAIL_SEND_FAILED', urgency: decision.urgency }, user.uid);
    }
  }

  logger.stageEnd('NOTIFY', notifyDurationMs, {
    emailEnabled,
    emailSent,
    urgency: decision.urgency,
    subject: emailContent.subject.slice(0, 60),
  }, user.uid);

  // ─── ⑦ STORE: batch-write all Firestore data ──────────────────────────────
  logger.stageStart('STORE', user.uid);

  const memoryUpdate = buildMemoryUpdate(
    user.uid,
    metrics,
    decision.recommendations,
    memory,
  );

  // All writes execute concurrently — activities batch, insights batch,
  // report single-write, memory upsert — then settle together
  const [activitiesResult, insightsStoreResult, reportStoreResult, memoryStoreResult] =
    await Promise.allSettled([
      deps.firestore.batchWriteActivities(user.uid, activities),
      deps.firestore.writeInsights(user.uid, insights),
      deps.firestore.writeReport(user.uid, report),
      deps.firestore.updateAgentMemory(user.uid, memoryUpdate),
    ]);

  // Log any STORE failures without aborting — data may be partially written
  const storeErrors: string[] = [];

  if (activitiesResult.status === 'rejected') {
    storeErrors.push(`activities: ${String(activitiesResult.reason)}`);
  } else if (!activitiesResult.value.ok) {
    storeErrors.push(`activities: ${activitiesResult.value.error.message}`);
  }

  if (insightsStoreResult.status === 'rejected') {
    storeErrors.push(`insights: ${String(insightsStoreResult.reason)}`);
  } else if (!insightsStoreResult.value.ok) {
    storeErrors.push(`insights: ${insightsStoreResult.value.error.message}`);
  }

  if (reportStoreResult.status === 'rejected') {
    storeErrors.push(`report: ${String(reportStoreResult.reason)}`);
  } else if (!reportStoreResult.value.ok) {
    storeErrors.push(`report: ${reportStoreResult.value.error.message}`);
  }

  if (memoryStoreResult.status === 'rejected') {
    storeErrors.push(`memory: ${String(memoryStoreResult.reason)}`);
  } else if (!memoryStoreResult.value.ok) {
    storeErrors.push(`memory: ${memoryStoreResult.value.error.message}`);
  }

  const reportStored =
    reportStoreResult.status === 'fulfilled' && reportStoreResult.value.ok;

  logger.stageEnd('STORE', timer.lap(), {
    activitiesWritten: activities.length,
    insightsWritten: insights.length,
    reportStored,
    memoryUpdated: memoryStoreResult.status === 'fulfilled' && memoryStoreResult.value.ok,
    storeErrors,
  }, user.uid);

  // Collect all non-fatal errors into a single array — avoids spread collision
  const userErrors: string[] = [
    ...storeErrors,
    ...(githubRateLimitHit ? ['GitHub rate limit hit — used simulated data'] : []),
  ];

  return {
    uid: user.uid,
    email: user.email,
    activityCount: activities.length,
    insightCount: insights.length,
    reportStored,
    emailSent,
    durationMs: timer.total(),
    ...(userErrors.length > 0 ? { error: userErrors.join(' | ') } : {}),
  };
}

// ─── Lambda Handler ───────────────────────────────────────────────────────────

/**
 * Lambda entry point — invoked by EventBridge Scheduler at 7:00 AM IST.
 *
 * This function is intentionally thin:
 *   - Loads secrets
 *   - Creates service instances
 *   - Orchestrates the pipeline
 *   - Aggregates results
 *   - Always returns a structured result (never throws)
 */
export const handler = async (
  _event: ScheduledEvent,
): Promise<GuardianRunResult> => {
  const runId = generateRunId();
  const startedAt = new Date().toISOString();
  const handlerTimer = new StageTimer();
  const logger = new StructuredLogger(runId);

  logger.info('GUARDIAN', {
    event: 'RUN_START',
    runId,
    startedAt,
    region: process.env['AWS_REGION'] ?? 'unknown',
    functionVersion: process.env['AWS_LAMBDA_FUNCTION_VERSION'] ?? '$LATEST',
  });

  // ── Load secrets (cached after cold start) ─────────────────────────────────
  const secretsResult = await loadSecrets();

  if (!secretsResult.ok) {
    // Fatal: cannot proceed without credentials
    logger.error('GUARDIAN', secretsResult.error, { event: 'SECRETS_LOAD_FAILED' });
    const errorResult: GuardianRunResult = {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: handlerTimer.total(),
      usersProcessed: 0,
      usersSucceeded: 0,
      usersFailed: 0,
      insightsGenerated: 0,
      emailsSent: 0,
      errors: [secretsResult.error.message],
    };
    return errorResult;
  }

  const secrets = secretsResult.value;
  logger.info('GUARDIAN', { event: 'SECRETS_LOADED' });

  // ── Initialize services ────────────────────────────────────────────────────
  const firestoreService = createFirestoreService(secrets.firebaseServiceAccount, logger);
  const services: ServiceContainer = {
    firestore: firestoreService,
    github: createGitHubService(),
    groq: createGroqService(secrets.groqApiKey, logger),
    ses: createSesService(secrets.ses),
    cloudwatch: createCloudWatchService(logger),
    dashboardUrl: secrets.ses.dashboardUrl,
  };

  // ── Stage ①: OBSERVE — load all active users ────────────────────────────────
  logger.stageStart('OBSERVE');
  const usersResult = await services.firestore.getActiveUsers();

  if (!usersResult.ok) {
    logger.error('OBSERVE', usersResult.error, { event: 'USER_LOAD_FAILED' });
    const errorResult: GuardianRunResult = {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: handlerTimer.total(),
      usersProcessed: 0,
      usersSucceeded: 0,
      usersFailed: 0,
      insightsGenerated: 0,
      emailsSent: 0,
      errors: [`Failed to load users: ${usersResult.error.message}`],
    };
    return errorResult;
  }

  const users: UserRecord[] = usersResult.value;
  logger.stageEnd('OBSERVE', handlerTimer.lap(), {
    userCount: users.length,
    userIds: users.map(u => u.uid),
  });

  if (users.length === 0) {
    logger.info('GUARDIAN', { event: 'NO_ACTIVE_USERS', message: 'No users with connected GitHub accounts found' });
    const emptyResult: GuardianRunResult = {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: handlerTimer.total(),
      usersProcessed: 0,
      usersSucceeded: 0,
      usersFailed: 0,
      insightsGenerated: 0,
      emailsSent: 0,
      errors: [],
    };
    return emptyResult;
  }

  // ── Stages ②–⑦: process each user in parallel ─────────────────────────────
  // Promise.allSettled ensures all users are attempted regardless of individual failures
  logger.info('GUARDIAN', { event: 'PIPELINE_START', userCount: users.length });

  const settledResults = await Promise.allSettled(
    users.map(user => processUser(user, services, logger)),
  );

  // ── Aggregate results ──────────────────────────────────────────────────────
  const userResults: UserPipelineResult[] = [];
  const runErrors: string[] = [];
  let insightsGenerated = 0;
  let emailsSent = 0;
  let groqFallbacks = 0;
  let githubRateLimitHits = 0;

  for (const settled of settledResults) {
    if (settled.status === 'fulfilled') {
      const result = settled.value;
      userResults.push(result);
      insightsGenerated += result.insightCount;
      if (result.emailSent) emailsSent++;
      // Count rate-limit hits and Groq fallbacks from per-user error strings
      if (result.error?.includes('rate limit')) githubRateLimitHits++;
      if (result.error?.includes('Groq') || result.insightCount === 0) groqFallbacks++;
    } else {
      // processUser itself should never reject — this is a safety net
      const errorMsg = settled.reason instanceof Error
        ? settled.reason.message
        : String(settled.reason);
      runErrors.push(`Unexpected pipeline failure: ${errorMsg}`);
      logger.error('GUARDIAN', new Error(errorMsg), { event: 'UNEXPECTED_USER_PIPELINE_FAILURE' });
    }
  }

  // Success = report stored in Firestore (email is optional / disabled by default)
  const usersSucceeded = userResults.filter(r => r.reportStored).length;
  const usersFailed = users.length - usersSucceeded;

  logger.info('GUARDIAN', {
    event: 'PIPELINE_COMPLETE',
    usersProcessed: users.length,
    usersSucceeded,
    usersFailed,
    insightsGenerated,
    emailsSent,
  });

  // ── Stage ⑧: AUDIT — write run log + emit CloudWatch metrics ──────────────
  const completedAt = new Date().toISOString();
  const totalDurationMs = handlerTimer.total();

  const guardianRun = {
    runId,
    triggeredAt: startedAt,
    completedAt,
    durationMs: totalDurationMs,
    usersProcessed: users.length,
    insightsGenerated,
    emailsSent,
    errors: runErrors,
  };

  // Fire audit writes in parallel — neither blocks the response
  await Promise.allSettled([
    services.firestore.writeGuardianRun(guardianRun),
    services.cloudwatch.recordExecution({
      durationMs: totalDurationMs,
      usersProcessed: users.length,
      insightsGenerated,
      emailsSent,
      failures: usersFailed,
      groqFallbacks,
      githubRateLimitHits,
    } satisfies ExecutionMetrics),
  ]);

  const finalResult: GuardianRunResult = {
    runId,
    startedAt,
    completedAt,
    durationMs: totalDurationMs,
    usersProcessed: users.length,
    usersSucceeded,
    usersFailed,
    insightsGenerated,
    emailsSent,
    errors: runErrors,
  };

  logger.info('GUARDIAN', {
    event: 'RUN_COMPLETE',
    ...finalResult,
  });

  return finalResult;
};
