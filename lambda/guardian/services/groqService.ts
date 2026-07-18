/**
 * @file lambda/guardian/services/groqService.ts
 * @description Groq AI service — wraps shared/groq.ts with retry, fallback, and logging.
 *
 * The Lambda's Groq service differs from the frontend's usage in two ways:
 *   1. The API key comes from AWS Secrets Manager (not import.meta.env).
 *   2. Retry logic is applied (exponential back-off, 3 attempts max).
 *
 * Business logic (prompt building, fallbacks) stays in shared/.
 * This class is purely about reliability and observability.
 */

import { callGroq } from '../../../shared/groq.ts';
import {
  buildInsightPrompt,
  buildReportPrompt,
  buildFallbackInsights,
  buildFallbackReport,
} from '../../../shared/prompts.ts';
import type {
  ComputedMetrics,
  Decision,
  InsightData,
  ReportData,
} from '../../../shared/types.ts';
import type { ILogger } from '../utils/logger.ts';
import type { Result } from '../utils/result.ts';
import { ok, err } from '../utils/result.ts';

// ─── Service Interface ────────────────────────────────────────────────────────

export interface IGroqService {
  /** Generates 4 coaching insights. Falls back to narrative text if Groq is unavailable. */
  generateInsights(
    metrics: ComputedMetrics,
    decision: Decision,
  ): Promise<Result<ReadonlyArray<Omit<InsightData, 'uid' | 'createdAt'>>>>;

  /** Generates the weekly performance report. Falls back to narrative text if Groq is unavailable. */
  generateReport(
    metrics: ComputedMetrics,
    decision: Decision,
  ): Promise<Result<Omit<ReportData, 'uid' | 'timestamp'>>>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
/** Milliseconds to wait between retries (doubles each attempt). */
const INITIAL_RETRY_DELAY_MS = 1_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** True if the error is likely transient and worth retrying. */
function isRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();
  // Groq 429 (rate limit) and 503 (service unavailable) are retryable
  return (
    message.includes('429') ||
    message.includes('503') ||
    message.includes('timeout') ||
    message.includes('network')
  );
}

async function callWithRetry(
  prompt: string,
  apiKey: string,
  logger: ILogger,
  context: string,
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<Result<string>> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = await callGroq(prompt, apiKey, options);
      if (attempt > 1) {
        logger.info('PLAN', { event: 'GROQ_RETRY_SUCCESS', context, attempt });
      }
      return ok(text);
    } catch (thrown: unknown) {
      lastError = thrown instanceof Error ? thrown : new Error(String(thrown));

      const willRetry = attempt < MAX_RETRIES && isRetryable(lastError);
      logger.warn('PLAN', {
        event: 'GROQ_CALL_FAILED',
        context,
        attempt,
        willRetry,
        errorMessage: lastError.message,
      });

      if (willRetry) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delayMs);
      }
    }
  }

  return err(lastError);
}

// ─── Implementation ───────────────────────────────────────────────────────────

class GroqService implements IGroqService {
  constructor(
    private readonly apiKey: string,
    private readonly logger: ILogger,
  ) {}

  async generateInsights(
    metrics: ComputedMetrics,
    decision: Decision,
  ): Promise<Result<ReadonlyArray<Omit<InsightData, 'uid' | 'createdAt'>>>> {
    const prompt = buildInsightPrompt(metrics, decision);

    const rawResult = await callWithRetry(
      prompt,
      this.apiKey,
      this.logger,
      'generateInsights',
      { temperature: 0.65, maxTokens: 1200 },
    );

    if (!rawResult.ok) {
      this.logger.warn('PLAN', {
        event: 'GROQ_INSIGHTS_FALLBACK',
        reason: rawResult.error.message,
      });
      // Return fallback as a successful Result — the pipeline continues
      return ok(buildFallbackInsights(metrics, decision));
    }

    try {
      const parsed = JSON.parse(rawResult.value) as {
        insights?: Omit<InsightData, 'uid' | 'createdAt'>[];
      };
      const raw = Array.isArray(parsed) ? parsed : (parsed.insights ?? []);
      const insights = raw.map(i => ({
        type: (i.type ?? 'neutral') as InsightData['type'],
        title: i.title ?? 'Insight',
        content: i.content ?? '',
        recommendation: i.recommendation ?? '',
      }));
      return ok(insights);
    } catch {
      this.logger.warn('PLAN', { event: 'GROQ_INSIGHTS_PARSE_FAILED', fallback: true });
      return ok(buildFallbackInsights(metrics, decision));
    }
  }

  async generateReport(
    metrics: ComputedMetrics,
    decision: Decision,
  ): Promise<Result<Omit<ReportData, 'uid' | 'timestamp'>>> {
    const prompt = buildReportPrompt(metrics, decision);

    const rawResult = await callWithRetry(
      prompt,
      this.apiKey,
      this.logger,
      'generateReport',
      { temperature: 0.55, maxTokens: 1400 },
    );

    if (!rawResult.ok) {
      this.logger.warn('PLAN', {
        event: 'GROQ_REPORT_FALLBACK',
        reason: rawResult.error.message,
      });
      const fallback = buildFallbackReport(metrics, decision);
      return ok({
        ...fallback,
        nextWeekPctChange: metrics.nextWeekPctChange,
        weekEnding: formatWeekEnding(),
      });
    }

    try {
      const parsed = JSON.parse(rawResult.value) as Partial<ReportData>;
      return ok({
        summaryText: parsed.summaryText ?? '',
        headline: parsed.headline ?? 'Weekly Performance Summary',
        keyWin: parsed.keyWin ?? '',
        keyRisk: parsed.keyRisk ?? '',
        productivityScore: parsed.productivityScore ?? metrics.productivityScore,
        burnoutRiskStatus: parsed.burnoutRiskStatus ?? metrics.burnoutRiskStatus,
        nextWeekForecast: parsed.nextWeekForecast ?? metrics.nextWeekPrediction ?? 'Stable',
        nextWeekPctChange: metrics.nextWeekPctChange,
        weekEnding: formatWeekEnding(),
      });
    } catch {
      this.logger.warn('PLAN', { event: 'GROQ_REPORT_PARSE_FAILED', fallback: true });
      const fallback = buildFallbackReport(metrics, decision);
      return ok({
        ...fallback,
        nextWeekPctChange: metrics.nextWeekPctChange,
        weekEnding: formatWeekEnding(),
      });
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGroqService(apiKey: string, logger: ILogger): IGroqService {
  return new GroqService(apiKey, logger);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatWeekEnding(): string {
  return new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}
