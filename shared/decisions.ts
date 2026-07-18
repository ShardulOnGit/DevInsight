/**
 * @file shared/decisions.ts
 * @description The DECIDE stage — DevInsight Guardian's reasoning layer.
 *
 * This is what separates an AI agent from a scheduled reporting script.
 * The DECIDE function filters noise, prioritizes signals, checks memory
 * for adaptive behavior, and produces a structured Decision that changes
 * the downstream Groq prompt and email tone.
 *
 * Pure function — no side effects, no SDK, no I/O.
 */

import type {
  ComputedMetrics,
  Decision,
  Recommendation,
  AgentMemory,
  AgentFocus,
  UrgencyLevel,
  RecommendationCategory,
  RecommendationPriority,
} from './types';

// ─── Significance Thresholds ──────────────────────────────────────────────────
// Issues below these thresholds are classified as noise and ignored.

const LATE_NIGHT_THRESHOLD = 2;     // commits after 10pm before it's worth mentioning
const WEEKEND_THRESHOLD = 2;        // weekend commits before it's worth mentioning
const LOW_PRODUCTIVITY_THRESHOLD = 40; // productivityScore below this triggers a flag
const HIGH_PRODUCTIVITY_THRESHOLD = 75; // above this with good consistency → celebrate
const LOW_CONSISTENCY_THRESHOLD = 5;  // active days below this in 14-day window

// ─── Priority Weights for sorting ────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<RecommendationPriority, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
};

// ─── Candidate Recommendation Generators ─────────────────────────────────────

function generateCandidates(
  metrics: ComputedMetrics,
  memory: AgentMemory | null,
): Recommendation[] {
  const candidates: Recommendation[] = [];
  const prev = memory?.lastMetrics ?? null;
  const prevRecs = memory?.lastRecommendations ?? [];

  // ── Burnout: late-night commits ───────────────────────────────────────────
  if (metrics.totalLateNight > LATE_NIGHT_THRESHOLD) {
    const improvingSinceLast = prev && prev.totalLateNight > metrics.totalLateNight;
    const worseningSinceLast = prev && prev.totalLateNight < metrics.totalLateNight;

    // If previous coaching on burnout made things worse, escalate
    const prevWasBurnout = prevRecs[0]?.category === 'burnout';
    const priority: RecommendationPriority =
      metrics.burnoutRiskStatus === 'High' || (prevWasBurnout && worseningSinceLast)
        ? 'CRITICAL'
        : 'HIGH';

    const confidence = metrics.burnoutRiskStatus === 'High' ? 92 : 78;
    const trendNote = improvingSinceLast
      ? ' (improving since last check — keep this going)'
      : worseningSinceLast
      ? ' (increasing since last check — this needs attention now)'
      : '';

    candidates.push({
      priority,
      confidence,
      reason: `${metrics.totalLateNight} commits detected after 10 PM${trendNote}. Late-night coding correlates with a 30% increase in next-day error rates and slows recovery time.`,
      action: 'Set a hard IDE shutdown alarm at 8:30 PM for the next 5 consecutive days.',
      category: 'burnout',
    });
  }

  // ── Burnout: weekend commits ──────────────────────────────────────────────
  if (metrics.totalWeekend > WEEKEND_THRESHOLD) {
    const priority: RecommendationPriority = metrics.totalWeekend > 10 ? 'HIGH' : 'MEDIUM';
    candidates.push({
      priority,
      confidence: 71,
      reason: `${metrics.totalWeekend} weekend commits detected. Engineering teams that protect weekends sustain output 22% higher on the following Monday.`,
      action: 'Block weekends as no-commit days next week to rebuild cognitive reserves.',
      category: 'wellbeing',
    });
  }

  // ── Productivity: high performance ───────────────────────────────────────
  if (
    metrics.productivityScore >= HIGH_PRODUCTIVITY_THRESHOLD &&
    metrics.consistency >= 80
  ) {
    const prevAlsoHigh = prev && prev.productivityScore >= HIGH_PRODUCTIVITY_THRESHOLD;
    candidates.push({
      priority: prevAlsoHigh ? 'HIGH' : 'MEDIUM',
      confidence: 87,
      reason: `Productivity score of ${metrics.productivityScore}/100 with ${metrics.consistency}% consistency is in the top quartile of sustainable engineering output.`,
      action:
        'Protect this momentum: schedule one 90-minute deep work block before 10 AM daily this week and guard it against interruptions.',
      category: 'productivity',
    });
  }

  // ── Productivity: low performance ─────────────────────────────────────────
  if (metrics.productivityScore < LOW_PRODUCTIVITY_THRESHOLD && metrics.totalCommits > 0) {
    const prevAlsoLow = prev && prev.productivityScore < LOW_PRODUCTIVITY_THRESHOLD;
    const priority: RecommendationPriority = prevAlsoLow ? 'HIGH' : 'MEDIUM';
    candidates.push({
      priority,
      confidence: prevAlsoLow ? 74 : 62,
      reason: `Productivity score of ${metrics.productivityScore}/100 is below the healthy threshold.${prevAlsoLow ? ' This is the second consecutive period of low output — a pattern, not a one-off.' : ''}`,
      action:
        'Complete one fully-focused task before checking email or Slack tomorrow. Protect the first 60 minutes of your day.',
      category: 'productivity',
    });
  }

  // ── Consistency: low active days ──────────────────────────────────────────
  if (
    metrics.activeDays < LOW_CONSISTENCY_THRESHOLD &&
    metrics.totalTrackedDays >= 7
  ) {
    candidates.push({
      priority: 'MEDIUM',
      confidence: 64,
      reason: `Only ${metrics.activeDays} active days out of ${metrics.totalTrackedDays} tracked. Inconsistent output compounds into missed deadlines and harder context-switching.`,
      action:
        'Commit to one meaningful commit every day for the next 7 days — even if it is just documentation or a README update.',
      category: 'consistency',
    });
  }

  // ── Consistency: exceptional streak ──────────────────────────────────────
  if (metrics.consistency >= 90) {
    candidates.push({
      priority: 'MEDIUM',
      confidence: 82,
      reason: `${metrics.consistency}% daily activity consistency over ${metrics.totalTrackedDays} days is exceptional. Developers who sustain this for 90+ days are 3x less likely to experience burnout.`,
      action:
        'Log your current daily routine this week — your habit stack is working and worth documenting.',
      category: 'consistency',
    });
  }

  // ── Positive trend ────────────────────────────────────────────────────────
  if (metrics.nextWeekPctChange >= 10) {
    candidates.push({
      priority: 'MEDIUM',
      confidence: 75,
      reason: `Linear trajectory projects +${metrics.nextWeekPctChange}% output next week. Momentum is building.`,
      action:
        'Your velocity is strong. Shift focus to code quality this week — review open PRs and add tests rather than chasing commit count.',
      category: 'productivity',
    });
  }

  return candidates;
}

// ─── Focus & Urgency Classification ──────────────────────────────────────────

function computeFocus(metrics: ComputedMetrics): AgentFocus {
  if (metrics.burnoutRiskStatus === 'High') return 'burnout';
  if (
    metrics.burnoutRiskStatus === 'Medium' &&
    metrics.totalLateNight > LATE_NIGHT_THRESHOLD
  )
    return 'burnout';
  if (
    metrics.productivityScore >= HIGH_PRODUCTIVITY_THRESHOLD &&
    metrics.consistency >= 80
  )
    return 'productivity';
  if (metrics.consistency < 50) return 'consistency';
  return 'balance';
}

function computeUrgency(metrics: ComputedMetrics): UrgencyLevel {
  if (metrics.burnoutRiskStatus === 'High') return 'CRITICAL';
  if (metrics.productivityScore >= 80 && metrics.consistency >= 85) return 'CELEBRATORY';
  return 'NORMAL';
}

// ─── Memory-Based Acknowledgement ────────────────────────────────────────────

function buildAcknowledgement(
  memory: AgentMemory | null,
  metrics: ComputedMetrics,
): string | null {
  if (!memory || memory.lastRecommendations.length === 0) return null;

  const prev = memory.lastMetrics;
  const prevPrimaryCategory = memory.lastRecommendations[0]?.category as RecommendationCategory;

  // Burnout coaching improved
  if (
    (prevPrimaryCategory === 'burnout' || prevPrimaryCategory === 'wellbeing') &&
    metrics.totalLateNight < prev.totalLateNight
  ) {
    const delta = prev.totalLateNight - metrics.totalLateNight;
    return `Good progress on late-night coding — you reduced it by ${delta} commit${delta > 1 ? 's' : ''} since yesterday's brief. Keep this trajectory.`;
  }

  // Productivity coaching improved
  if (
    prevPrimaryCategory === 'productivity' &&
    metrics.productivityScore > prev.productivityScore + 2
  ) {
    return `Yesterday's focus paid off — your productivity score improved by ${metrics.productivityScore - prev.productivityScore} points.`;
  }

  // Consistency coaching improved
  if (
    prevPrimaryCategory === 'consistency' &&
    metrics.consistency > prev.consistency
  ) {
    return `Your consistency improved from ${prev.consistency}% to ${metrics.consistency}% — the daily commit habit is taking hold.`;
  }

  return null;
}

// ─── Strategy Shift Detection ─────────────────────────────────────────────────

function detectStrategyShift(
  memory: AgentMemory | null,
  metrics: ComputedMetrics,
): boolean {
  if (!memory || memory.lastRecommendations.length === 0) return false;

  const prev = memory.lastMetrics;
  const prevPrimaryCategory = memory.lastRecommendations[0]?.category as RecommendationCategory;

  // Previous burnout coaching → metric got worse → change strategy
  if (
    (prevPrimaryCategory === 'burnout' || prevPrimaryCategory === 'wellbeing') &&
    metrics.totalLateNight > prev.totalLateNight
  )
    return true;

  // Previous productivity coaching → score dropped further → change strategy
  if (
    prevPrimaryCategory === 'productivity' &&
    metrics.productivityScore < prev.productivityScore - 5
  )
    return true;

  // Previous consistency coaching → still low → change strategy
  if (
    prevPrimaryCategory === 'consistency' &&
    metrics.activeDays <= prev.activeDays
  )
    return true;

  return false;
}

// ─── Main DECIDE Function ─────────────────────────────────────────────────────

/**
 * The agent's reasoning stage. Evaluates all detected signals, filters noise,
 * prioritizes the top 3 recommendations, and produces a Decision that flows
 * into the Groq prompt builder and email builder.
 *
 * This function is what differentiates DevInsight Guardian from a scheduled
 * reporting script — it makes judgment calls, not just calculations.
 *
 * @param metrics     - Computed metrics for this period
 * @param memory      - Previous run's context (null on first run per user)
 * @param topRepository - Name of the most active repository (for email context)
 */
export function decide(
  metrics: ComputedMetrics,
  memory: AgentMemory | null,
  topRepository: string | null,
): Decision {
  const allCandidates = generateCandidates(metrics, memory);

  // Sort by priority weight, then confidence as tiebreaker
  const sorted = [...allCandidates].sort((a, b) => {
    const weightDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (weightDiff !== 0) return weightDiff;
    return b.confidence - a.confidence;
  });

  // Keep top 3 only — information overload defeats the purpose
  const recommendations = sorted.slice(0, 3);
  const ignoredIssues = sorted.slice(3).map(r => r.action);

  const acknowledgement = buildAcknowledgement(memory, metrics);
  const strategyShift = detectStrategyShift(memory, metrics);

  return {
    focus: computeFocus(metrics),
    urgency: computeUrgency(metrics),
    recommendations,
    ignoredIssues,
    topRepository,
    acknowledgement,
    strategyShift,
  };
}
