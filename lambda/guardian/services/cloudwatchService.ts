/**
 * @file lambda/guardian/services/cloudwatchService.ts
 * @description CloudWatch custom metrics emitter for DevInsight Guardian.
 *
 * Emits all execution metrics in a single PutMetricData call to minimize
 * API calls and stay within Lambda timeout budgets.
 *
 * Metric namespace: DevInsight/Guardian
 *
 * Metrics published per run:
 *   ExecutionCount          — 1 per run (enables alarm on zero = missed run)
 *   UsersProcessed          — total users attempted
 *   InsightsGenerated       — total insight documents created
 *   EmailsSent              — successful SES sends
 *   ExecutionDuration       — total Lambda duration in ms
 *   ExecutionFailures       — users whose pipeline failed completely
 *   GroqFallbacks           — times the narrative fallback was used
 *   GitHubRateLimitHits     — GitHub 429/403 responses (signals token expiry)
 *
 * Failures are non-fatal: if PutMetricData fails, we log but do not abort.
 */

import {
  CloudWatchClient,
  PutMetricDataCommand,
  type MetricDatum,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import type { ExecutionMetrics } from '../types.ts';
import type { ILogger } from '../utils/logger.ts';

// ─── Service Interface ────────────────────────────────────────────────────────

export interface ICloudWatchService {
  /**
   * Emits all Guardian execution metrics in a single API call.
   * Failure is logged but never propagated — metrics are best-effort.
   */
  recordExecution(metrics: ExecutionMetrics): Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METRIC_NAMESPACE = 'DevInsight/Guardian';
const MAX_METRICS_PER_CALL = 20; // CloudWatch limit is 1000 values, but we stay small

// Singleton client — reused across warm invocations
const cloudwatchClient = new CloudWatchClient({
  region: process.env['AWS_REGION'] ?? 'ap-south-1',
});

// ─── Implementation ───────────────────────────────────────────────────────────

class CloudWatchService implements ICloudWatchService {
  private readonly timestamp = new Date();

  constructor(private readonly logger: ILogger) {}

  async recordExecution(metrics: ExecutionMetrics): Promise<void> {
    const metricData: MetricDatum[] = [
      {
        MetricName: 'ExecutionCount',
        Value: 1,
        Unit: StandardUnit.Count,
        Timestamp: this.timestamp,
      },
      {
        MetricName: 'UsersProcessed',
        Value: metrics.usersProcessed,
        Unit: StandardUnit.Count,
        Timestamp: this.timestamp,
      },
      {
        MetricName: 'InsightsGenerated',
        Value: metrics.insightsGenerated,
        Unit: StandardUnit.Count,
        Timestamp: this.timestamp,
      },
      {
        MetricName: 'EmailsSent',
        Value: metrics.emailsSent,
        Unit: StandardUnit.Count,
        Timestamp: this.timestamp,
      },
      {
        MetricName: 'ExecutionDuration',
        Value: metrics.durationMs,
        Unit: StandardUnit.Milliseconds,
        Timestamp: this.timestamp,
      },
      {
        MetricName: 'ExecutionFailures',
        Value: metrics.failures,
        Unit: StandardUnit.Count,
        Timestamp: this.timestamp,
      },
      {
        MetricName: 'GroqFallbacks',
        Value: metrics.groqFallbacks,
        Unit: StandardUnit.Count,
        Timestamp: this.timestamp,
      },
      {
        MetricName: 'GitHubRateLimitHits',
        Value: metrics.githubRateLimitHits,
        Unit: StandardUnit.Count,
        Timestamp: this.timestamp,
      },
    ];

    // Sanity check: CloudWatch rejects batches exceeding the limit
    if (metricData.length > MAX_METRICS_PER_CALL) {
      this.logger.warn('STORE', {
        event: 'CLOUDWATCH_BATCH_OVERSIZED',
        count: metricData.length,
        limit: MAX_METRICS_PER_CALL,
      });
    }

    try {
      const command = new PutMetricDataCommand({
        Namespace: METRIC_NAMESPACE,
        MetricData: metricData,
      });
      await cloudwatchClient.send(command);
      this.logger.info('STORE', {
        event: 'CLOUDWATCH_METRICS_PUBLISHED',
        namespace: METRIC_NAMESPACE,
        metricCount: metricData.length,
      });
    } catch (thrown: unknown) {
      // Metrics emission failure must never abort the Lambda
      const error = thrown instanceof Error ? thrown : new Error(String(thrown));
      this.logger.error('STORE', error, {
        event: 'CLOUDWATCH_METRICS_FAILED',
        // Pipeline result is still committed — this is observability only
      });
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCloudWatchService(logger: ILogger): ICloudWatchService {
  return new CloudWatchService(logger);
}
