/**
 * @file shared/types.ts
 * @description Canonical TypeScript interfaces for DevInsight Guardian.
 *
 * This file is consumed by:
 *   - React frontend (via Vite's @shared alias)
 *   - AWS Lambda guardian (via lambda/guardian/tsconfig.json paths)
 *
 * RULE: This file must have zero runtime imports. Types only.
 */

// ─── GitHub API Types ─────────────────────────────────────────────────────────

export interface GitHubEvent {
  type: string;
  created_at: string;
  repo: { name: string };
  payload: {
    commits?: unknown[];
  };
}

// ─── Firestore Document Types ─────────────────────────────────────────────────

/**
 * Stored in /dailyActivities/{uid_date}.
 * uid is optional so computeMetrics() can accept plain activity arrays
 * from both the frontend (no uid in array items) and Lambda (uid present).
 */
export interface DailyActivity {
  uid?: string;
  date: string; // YYYY-MM-DD
  commits: number;
  linesChanged: number;
  deepWorkHours: number;
  lateNightCommits: number;
  weekendCommits: number;
  commitsByHour: Record<string, number>; // keys like "h14" for 2pm
}

/** Stored in /insights/{id} */
export interface InsightData {
  uid: string;
  type: 'positive' | 'warning' | 'neutral';
  title: string;
  content: string;
  recommendation: string;
  createdAt?: unknown; // serverTimestamp() is added on write
}

/** Stored in /reports/{id} */
export interface ReportData {
  uid: string;
  summaryText: string;
  headline: string;
  keyWin: string;
  keyRisk: string;
  productivityScore: number;
  burnoutRiskStatus: BurnoutRisk;
  nextWeekForecast: string;
  nextWeekPctChange: number;
  weekEnding: string;
  timestamp?: unknown; // serverTimestamp() is added on write
}

/** Stored in /agentMemory/{uid} — one document per user */
export interface AgentMemory {
  uid: string;
  lastRunDate: string; // YYYY-MM-DD
  lastMetrics: ComputedMetrics;
  lastRecommendations: Recommendation[];
  /** Rolling 7-day window of run summaries for trend analysis */
  runHistory: RunHistoryEntry[];
  updatedAt: unknown; // serverTimestamp on write
}

export interface RunHistoryEntry {
  date: string; // YYYY-MM-DD
  productivityScore: number;
  burnoutRiskStatus: BurnoutRisk;
  commitsTotal: number;
}

/** Stored in /guardianRuns/{runId} — audit log of each autonomous run */
export interface GuardianRun {
  runId: string;
  triggeredAt: string; // ISO string
  completedAt: string; // ISO string
  durationMs: number;
  usersProcessed: number;
  insightsGenerated: number;
  emailsSent: number;
  errors: string[];
}

// ─── Derived Repo Type ────────────────────────────────────────────────────────

export interface RecentRepo {
  repoName: string;
  commits: number;
  lastActive: string; // ISO string
}

// ─── Computation Types ────────────────────────────────────────────────────────

export type BurnoutRisk = 'Low' | 'Medium' | 'High';

export interface ComputedMetrics {
  totalCommits: number;
  totalDeepWork: number;
  totalLateNight: number;
  totalWeekend: number;
  activeDays: number;
  totalTrackedDays: number;
  consistency: number;         // 0–100, % of days with commits
  perActiveDayAverage: number; // commits per active day
  trend: string;               // e.g. "+12% trend" or "new dataset"
  weeklyTrend: string;         // e.g. "+12% vs prior period"
  productivityScore: number;   // 0–100
  burnoutRiskStatus: BurnoutRisk;
  nextWeekPctChange: number;   // numeric projection
  nextWeekPrediction: string;  // e.g. "+12% projected"
}

// ─── Decision & Agent Types ───────────────────────────────────────────────────

export type RecommendationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM';
export type RecommendationCategory =
  | 'burnout'
  | 'productivity'
  | 'consistency'
  | 'repository'
  | 'wellbeing';
export type UrgencyLevel = 'CRITICAL' | 'NORMAL' | 'CELEBRATORY';
export type AgentFocus = 'burnout' | 'productivity' | 'consistency' | 'balance';

/**
 * A single structured recommendation with full diagnostic context.
 * Every recommendation surfaced to the developer carries priority,
 * confidence, and an evidence-based reason — never just an action.
 */
export interface Recommendation {
  priority: RecommendationPriority;
  /** 0–100: how confident the agent is in this recommendation */
  confidence: number;
  /** Evidence-based reason why this recommendation was surfaced */
  reason: string;
  /** Concrete, specific action with time/parameters */
  action: string;
  category: RecommendationCategory;
}

/**
 * The output of the DECIDE stage.
 * Flows into the Groq prompt builder and email builder.
 */
export interface Decision {
  focus: AgentFocus;
  urgency: UrgencyLevel;
  /** Top 3 recommendations sorted by priority. Never more than 3. */
  recommendations: Recommendation[];
  /** Issues detected but filtered as below significance threshold */
  ignoredIssues: string[];
  topRepository: string | null;
  /** Progress acknowledgement if memory shows improvement since yesterday */
  acknowledgement: string | null;
  /** True if yesterday's primary recommendation did not improve the metric */
  strategyShift: boolean;
}

// ─── Memory Assessment Types ──────────────────────────────────────────────────

export interface ProgressAssessment {
  commitsImproved: boolean;
  lateNightReduced: boolean;
  consistencyImproved: boolean;
  productivityImproved: boolean;
  overallImproved: boolean;
  delta: {
    commits: number;
    lateNight: number;
    consistency: number;
    productivityScore: number;
  };
}

// ─── GitHub Processing Output ─────────────────────────────────────────────────

export interface ProcessedActivity {
  activityByDay: Record<string, DailyActivity>;
  recentRepos: RecentRepo[];
}
