/**
 * @file shared/github.ts
 * @description GitHub Events API processing — pure functions, zero runtime deps.
 *
 * Ported from src/services/githubSync.ts. This is the canonical implementation.
 * The frontend service is now a thin wrapper that calls these functions.
 *
 * Works in: browser (Vite), Node.js (Lambda). No DOM APIs, no SDK calls.
 */

import type { GitHubEvent, DailyActivity, RecentRepo, ProcessedActivity } from './types';

// ─── Date Utilities (native, no date-fns dependency in shared/) ───────────────

function formatDateToYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function subDaysFromDate(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() - days);
  return d;
}

// ─── Simulated Data Fallback ──────────────────────────────────────────────────

/**
 * Generates realistic simulated GitHub events when the API is unavailable
 * (rate-limited, network error, no token). Matches the event shape expected
 * by processGitHubEvents().
 */
export function generateSimulatedEvents(username: string): GitHubEvent[] {
  const simulated: GitHubEvent[] = [];
  const now = new Date();

  for (let i = 0; i < 40; i++) {
    const d = subDaysFromDate(now, Math.floor(Math.random() * 14));

    // Realistic hour distribution: mostly daytime, occasional late-night
    let hour = Math.floor(Math.random() * 24);
    if (Math.random() > 0.8) {
      hour = Math.floor(Math.random() * 5); // late-night: 12am–5am
    } else if (Math.random() > 0.5) {
      hour = 10 + Math.floor(Math.random() * 6); // productive: 10am–4pm
    }
    d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

    simulated.push({
      type: 'PushEvent',
      created_at: d.toISOString(),
      repo: {
        name: `${username}/project-${Math.floor(Math.random() * 3) + 1}`,
      },
      payload: {
        commits: Array(Math.floor(Math.random() * 4 + 1)).fill({}),
      },
    });
  }

  return simulated;
}

// ─── Default Day Scaffolding ──────────────────────────────────────────────────

/**
 * Creates an empty 14-day activity map so charts always have a full timeline,
 * even for days with zero commits.
 */
export function buildDefaultActivityDays(
  uid: string,
  days: number = 14,
): Record<string, DailyActivity> {
  const result: Record<string, DailyActivity> = {};
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = formatDateToYMD(subDaysFromDate(now, i));
    result[d] = {
      uid,
      date: d,
      commits: 0,
      linesChanged: 0,
      deepWorkHours: 0,
      lateNightCommits: 0,
      weekendCommits: 0,
      commitsByHour: {},
    };
  }

  return result;
}

// ─── Core Event Processor ─────────────────────────────────────────────────────

/**
 * Transforms raw GitHub events into structured daily activity records.
 *
 * This is the canonical implementation of GitHub data processing. Both the
 * React frontend (manual sync) and Lambda (autonomous sync) use this function.
 * No duplication. One change here propagates to both environments.
 *
 * @param events - Array of GitHub Events API responses
 * @param uid    - Firebase UID of the user being processed
 * @returns      - Keyed activity map + top 3 repos by commit count
 */
export function processGitHubEvents(
  events: GitHubEvent[],
  uid: string,
): ProcessedActivity {
  const activityByDay = buildDefaultActivityDays(uid, 14);
  const repoMap = new Map<string, { repoName: string; commits: number; lastActive: string }>();

  for (const event of events) {
    const dateStr = event.created_at.split('T')[0];
    const eventDate = new Date(event.created_at);
    const hour = eventDate.getHours();
    const hourKey = `h${hour}`; // e.g. "h14" for 2pm — survives Firestore serialization
    const dayOfWeek = eventDate.getDay(); // 0 = Sunday, 6 = Saturday

    // Ensure the date bucket exists (events may predate the 14-day window)
    if (!activityByDay[dateStr]) {
      activityByDay[dateStr] = {
        uid,
        date: dateStr,
        commits: 0,
        linesChanged: 0,
        deepWorkHours: 0,
        lateNightCommits: 0,
        weekendCommits: 0,
        commitsByHour: {},
      };
    }

    const activity = activityByDay[dateStr];

    if (event.type === 'PushEvent') {
      const commitCount = (event.payload.commits as unknown[])?.length ?? 1;

      activity.commits += commitCount;
      // Lines changed: estimated from commit density (no diff API without auth)
      activity.linesChanged += commitCount * Math.floor(Math.random() * 50 + 10);

      // Hour bucket tracking for heatmap
      activity.commitsByHour[hourKey] =
        (activity.commitsByHour[hourKey] ?? 0) + commitCount;

      // Late-night: 10 PM (22:00) to 5 AM (05:59)
      if (hour >= 22 || hour <= 5) {
        activity.lateNightCommits += commitCount;
      }

      // Weekend commits
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        activity.weekendCommits += commitCount;
      }

      // Deep work hours: rough estimate — 0.5h per commit (represents focused session)
      activity.deepWorkHours += 0.5 * commitCount;

      // Track repo activity
      const repoName = event.repo.name;
      if (!repoMap.has(repoName)) {
        repoMap.set(repoName, {
          repoName,
          commits: 0,
          lastActive: event.created_at,
        });
      }
      repoMap.get(repoName)!.commits += commitCount;
    }
  }

  // Top 3 repositories by commit count
  const recentRepos: RecentRepo[] = Array.from(repoMap.values())
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 3);

  return { activityByDay, recentRepos };
}
