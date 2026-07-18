/**
 * @file lambda/guardian/utils/logger.ts
 * @description Structured JSON logger for CloudWatch Logs Insights.
 *
 * Every log line is a single JSON object. CloudWatch Logs Insights can parse
 * these natively for filtering and aggregation.
 *
 * Log format:
 * {
 *   "level":     "INFO" | "WARN" | "ERROR",
 *   "timestamp": "2026-07-18T02:30:00.000Z",
 *   "runId":     "guardian-20260718-143020",
 *   "stage":     "ANALYZE",
 *   "uid":       "uid123",       // present for per-user log lines
 *   "durationMs": 342,           // present for stage-end log lines
 *   "data":      { ... },        // stage-specific data
 *   "error": {                   // present on ERROR level only
 *     "name":    "Error",
 *     "message": "...",
 *     "stack":   "..."           // omitted in production unless DEBUG=true
 *   }
 * }
 */

export interface ILogger {
  info(stage: string, data: Record<string, unknown>, uid?: string): void;
  warn(stage: string, data: Record<string, unknown>, uid?: string): void;
  error(stage: string, error: Error, data?: Record<string, unknown>, uid?: string): void;
  stageStart(stage: string, uid?: string): void;
  stageEnd(stage: string, durationMs: number, data?: Record<string, unknown>, uid?: string): void;
  stageError(stage: string, error: Error, durationMs: number, uid?: string): void;
}

const IS_DEBUG = process.env['DEBUG'] === 'true';

function serializeError(error: Error): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };
  if (IS_DEBUG && error.stack) {
    serialized['stack'] = error.stack;
  }
  return serialized;
}

function emit(
  level: 'INFO' | 'WARN' | 'ERROR',
  runId: string,
  stage: string,
  data: Record<string, unknown>,
  uid?: string,
  durationMs?: number,
  error?: Error,
): void {
  const entry: Record<string, unknown> = {
    level,
    timestamp: new Date().toISOString(),
    runId,
    stage,
  };

  if (uid !== undefined) entry['uid'] = uid;
  if (durationMs !== undefined) entry['durationMs'] = durationMs;
  if (Object.keys(data).length > 0) entry['data'] = data;
  if (error !== undefined) entry['error'] = serializeError(error);

  // console.log writes to stdout → CloudWatch Logs
  console.log(JSON.stringify(entry));
}

export class StructuredLogger implements ILogger {
  constructor(private readonly runId: string) {}

  info(stage: string, data: Record<string, unknown> = {}, uid?: string): void {
    emit('INFO', this.runId, stage, data, uid);
  }

  warn(stage: string, data: Record<string, unknown> = {}, uid?: string): void {
    emit('WARN', this.runId, stage, data, uid);
  }

  error(
    stage: string,
    error: Error,
    data: Record<string, unknown> = {},
    uid?: string,
  ): void {
    emit('ERROR', this.runId, stage, data, uid, undefined, error);
  }

  stageStart(stage: string, uid?: string): void {
    emit('INFO', this.runId, stage, { event: 'STAGE_START' }, uid);
  }

  stageEnd(
    stage: string,
    durationMs: number,
    data: Record<string, unknown> = {},
    uid?: string,
  ): void {
    emit('INFO', this.runId, stage, { event: 'STAGE_END', ...data }, uid, durationMs);
  }

  stageError(stage: string, error: Error, durationMs: number, uid?: string): void {
    emit('ERROR', this.runId, stage, { event: 'STAGE_ERROR' }, uid, durationMs, error);
  }
}

/** Minimal timer for measuring stage durations. */
export class StageTimer {
  private readonly start = Date.now();
  private last = Date.now();

  /** Returns ms elapsed since the last call to lap() (or construction). */
  lap(): number {
    const now = Date.now();
    const elapsed = now - this.last;
    this.last = now;
    return elapsed;
  }

  /** Returns total ms elapsed since construction. */
  total(): number {
    return Date.now() - this.start;
  }
}
