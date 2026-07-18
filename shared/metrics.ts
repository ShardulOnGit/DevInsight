/**
 * @file shared/metrics.ts
 * @description Pure metrics computation — the analytics engine of DevInsight Guardian.
 *
 * Extracted from geminiService.ts and reportService.ts (where it was duplicated).
 * This is now the single canonical implementation.
 *
 * All functions: pure, side-effect-free, zero runtime deps.
 * Works in: browser (Vite), Node.js (Lambda).
 */

import type { DailyActivity, ComputedMetrics, BurnoutRisk } from './types';

// ─── Individual Metric Computations ──────────────────────────────────────────

/**
 * Productivity score: weighted combination of deep work and commit volume.
 * Capped at 100. Returns 0 if no commits exist.
 */
export function computeProductivityScore(
  totalDeepWork: number,
  totalCommits: number,
): number {
  if (totalCommits === 0) return 0;
  return Math.min(100, Math.round(totalDeepWork * 2 + totalCommits * 0.5));
}

/**
 * Burnout risk classification based on late-night and weekend coding patterns.
 * Thresholds are derived from research on sustainable engineering output.
 */
export function computeBurnoutRisk(
  totalLateNight: number,
  totalWeekend: number,
): BurnoutRisk {
  if (totalLateNight > 10 || totalWeekend > 15) return 'High';
  if (totalLateNight > 4 || totalWeekend > 5) return 'Medium';
  return 'Low';
}

/**
 * Week-over-week trend string.
 * Splits the activity array in half and compares commit totals.
 */
export function computeTrend(sortedActivities: DailyActivity[]): string {
  const half = Math.floor(sortedActivities.length / 2);
  const recentHalf = sortedActivities.slice(half).reduce((s, a) => s + a.commits, 0);
  const priorHalf = sortedActivities.slice(0, half).reduce((s, a) => s + a.commits, 0);

  if (priorHalf === 0) return 'new dataset';
  const pct = Math.round(((recentHalf - priorHalf) / priorHalf) * 100);
  return `${recentHalf > priorHalf ? '+' : ''}${pct}% trend`;
}

/**
 * Linear regression forecast for next week's commit volume.
 * Returns percentage change vs current average and a human-readable string.
 * Returns 0 / empty string if there is insufficient data (<7 days).
 */
export function computeLinearForecast(
  sortedActivities: DailyActivity[],
): { pctChange: number; prediction: string } {
  if (sortedActivities.length < 7) {
    return { pctChange: 0, prediction: '' };
  }

  const n = Math.min(sortedActivities.length, 14);
  const recent = sortedActivities.slice(-n);

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  recent.forEach((a, i) => {
    sumX += i;
    sumY += a.commits;
    sumXY += i * a.commits;
    sumX2 += i * i;
  });

  const denominator = n * sumX2 - sumX * sumX;
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const intercept = (sumY - slope * sumX) / n;
  const nextAvg = Math.max(0, intercept + slope * (n + 3.5));
  const currentAvg = sumY / n;
  const pctChange =
    currentAvg > 0 ? Math.round(((nextAvg - currentAvg) / currentAvg) * 100) : 0;

  return {
    pctChange,
    prediction: `${pctChange >= 0 ? '+' : ''}${pctChange}% projected`,
  };
}

// ─── Master Computation ───────────────────────────────────────────────────────

/**
 * Computes all metrics from a raw activity array.
 *
 * This is the canonical analytics function. Both the frontend (manual sync)
 * and Lambda (autonomous morning run) produce ComputedMetrics using this
 * single implementation. The Decision and prompt builders consume this output.
 *
 * @param activities - Array of DailyActivity records (uid is optional)
 */
export function computeMetrics(activities: DailyActivity[]): ComputedMetrics {
  if (activities.length === 0) {
    return {
      totalCommits: 0,
      totalDeepWork: 0,
      totalLateNight: 0,
      totalWeekend: 0,
      activeDays: 0,
      totalTrackedDays: 0,
      consistency: 0,
      perActiveDayAverage: 0,
      trend: 'new dataset',
      weeklyTrend: 'first tracked period',
      productivityScore: 0,
      burnoutRiskStatus: 'Low',
      nextWeekPctChange: 0,
      nextWeekPrediction: '',
    };
  }

  const totalCommits = activities.reduce((s, a) => s + (a.commits ?? 0), 0);
  const totalDeepWork = activities.reduce((s, a) => s + (a.deepWorkHours ?? 0), 0);
  const totalLateNight = activities.reduce((s, a) => s + (a.lateNightCommits ?? 0), 0);
  const totalWeekend = activities.reduce((s, a) => s + (a.weekendCommits ?? 0), 0);
  const activeDays = activities.filter(a => (a.commits ?? 0) > 0).length;
  const consistency = Math.round((activeDays / activities.length) * 100);
  const perActiveDayAverage = activeDays > 0 ? Math.round(totalCommits / activeDays) : 0;

  const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));
  const trend = computeTrend(sorted);

  // Weekly trend: for the report summary paragraph
  const half = Math.floor(sorted.length / 2);
  const recentCommits = sorted.slice(half).reduce((s, a) => s + a.commits, 0);
  const priorCommits = sorted.slice(0, half).reduce((s, a) => s + a.commits, 0);
  const weeklyTrend =
    priorCommits > 0
      ? `${recentCommits >= priorCommits ? '+' : ''}${Math.round(
          ((recentCommits - priorCommits) / priorCommits) * 100,
        )}% vs prior period`
      : 'first tracked period';

  const productivityScore = computeProductivityScore(totalDeepWork, totalCommits);
  const burnoutRiskStatus = computeBurnoutRisk(totalLateNight, totalWeekend);
  const { pctChange: nextWeekPctChange, prediction: nextWeekPrediction } =
    computeLinearForecast(sorted);

  return {
    totalCommits,
    totalDeepWork,
    totalLateNight,
    totalWeekend,
    activeDays,
    totalTrackedDays: activities.length,
    consistency,
    perActiveDayAverage,
    trend,
    weeklyTrend,
    productivityScore,
    burnoutRiskStatus,
    nextWeekPctChange,
    nextWeekPrediction,
  };
}
