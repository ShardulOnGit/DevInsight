/**
 * @file shared/memory.ts
 * @description Agent memory utilities — progress assessment and memory update builder.
 *
 * These pure functions power the agent's adaptive behavior:
 *   - assessProgress() compares today vs yesterday to detect improvements
 *   - buildMemoryUpdate() creates the Firestore document for /agentMemory/{uid}
 *
 * The Lambda reads agentMemory before the DECIDE stage and writes it after
 * the STORE stage. The frontend does not read or write agentMemory.
 *
 * Pure functions — no side effects, no SDK, zero runtime deps.
 */

import type {
  AgentMemory,
  ComputedMetrics,
  Recommendation,
  ProgressAssessment,
  RunHistoryEntry,
} from './types';

const MAX_HISTORY_ENTRIES = 7; // rolling 7-day window

/**
 * Compares today's metrics against yesterday's to detect measurable improvement.
 * Used by the DECIDE stage to build the acknowledgement string and detect
 * whether a strategy shift is needed.
 *
 * @param today  - ComputedMetrics from the current Lambda run
 * @param memory - AgentMemory from the previous run (null on first run)
 */
export function assessProgress(
  today: ComputedMetrics,
  memory: AgentMemory | null,
): ProgressAssessment | null {
  if (!memory) return null;

  const yesterday = memory.lastMetrics;

  const delta = {
    commits: today.totalCommits - yesterday.totalCommits,
    lateNight: today.totalLateNight - yesterday.totalLateNight,
    consistency: today.consistency - yesterday.consistency,
    productivityScore: today.productivityScore - yesterday.productivityScore,
  };

  return {
    commitsImproved: delta.commits > 0,
    lateNightReduced: delta.lateNight < 0,
    consistencyImproved: delta.consistency > 0,
    productivityImproved: delta.productivityScore > 2, // >2 points to avoid noise
    overallImproved: delta.productivityScore > 0 || delta.lateNight < 0,
    delta,
  };
}

/**
 * Builds the AgentMemory document to be written to Firestore /agentMemory/{uid}.
 * Maintains a rolling 7-day run history for trend analysis.
 *
 * @param uid            - Firebase UID of the user
 * @param today          - ComputedMetrics from this run
 * @param recommendations - Top recommendations generated this run
 * @param existingMemory - Previous AgentMemory document (null on first run)
 */
export function buildMemoryUpdate(
  uid: string,
  today: ComputedMetrics,
  recommendations: Recommendation[],
  existingMemory: AgentMemory | null,
): Omit<AgentMemory, 'updatedAt'> {
  const todayDate = new Date().toISOString().split('T')[0];

  const newEntry: RunHistoryEntry = {
    date: todayDate,
    productivityScore: today.productivityScore,
    burnoutRiskStatus: today.burnoutRiskStatus,
    commitsTotal: today.totalCommits,
  };

  // Prepend today's entry, remove entries for the same date (idempotent),
  // and keep only the most recent MAX_HISTORY_ENTRIES
  const existingHistory = (existingMemory?.runHistory ?? []).filter(
    entry => entry.date !== todayDate,
  );
  const runHistory = [newEntry, ...existingHistory].slice(0, MAX_HISTORY_ENTRIES);

  return {
    uid,
    lastRunDate: todayDate,
    lastMetrics: today,
    lastRecommendations: recommendations,
    runHistory,
  };
}

/**
 * Checks if the agent has run for this user today already (prevents duplicate runs).
 * @param memory - AgentMemory from Firestore (null if no prior run)
 * @returns true if already run today
 */
export function hasRunToday(memory: AgentMemory | null): boolean {
  if (!memory) return false;
  const today = new Date().toISOString().split('T')[0];
  return memory.lastRunDate === today;
}
