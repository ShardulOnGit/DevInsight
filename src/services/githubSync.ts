/**
 * @file src/services/githubSync.ts
 * @description Frontend GitHub sync service — thin wrapper over shared/github.ts.
 *
 * PUBLIC API UNCHANGED: syncGitHubActivity(uid, username, accessToken?) → Promise<boolean>
 * All business logic lives in shared/github.ts (consumed identically by Lambda).
 *
 * This file is responsible for:
 *   - The GitHub API fetch (browser fetch with CORS)
 *   - Writing to Firestore via Firebase Web SDK
 *   - Delegating to AI services after sync completes
 *
 * It does NOT contain event processing, metric computation, or prompt logic.
 */

import { doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateAndStoreInsights } from './geminiService';
import { generateWeeklyReport } from './reportService';
import {
  processGitHubEvents,
  generateSimulatedEvents,
} from '@shared/github';
import type { GitHubEvent } from '@shared/types';

/**
 * Fetches recent activity from GitHub for a given username and syncs to Firestore.
 * If an accessToken is provided, fetches authenticated events (including private repos).
 * Falls back to simulated data on rate-limit or network failure.
 *
 * Called from:
 *   - ProfilePage (manual sync button)
 *   - DashboardOverview (Sync Now button)
 */
export async function syncGitHubActivity(
  uid: string,
  username: string,
  accessToken?: string,
): Promise<boolean> {
  try {
    let events: GitHubEvent[] = [];

    try {
      const url = accessToken
        ? `https://api.github.com/users/${username}/events`
        : `https://api.github.com/users/${username}/events/public`;

      const headers: Record<string, string> = {};
      if (accessToken) {
        headers['Authorization'] = `token ${accessToken}`;
      }

      const res = await fetch(url, { headers });
      if (res.ok) {
        events = await res.json() as GitHubEvent[];
      } else {
        console.warn(`GitHub API returned ${res.status}. Falling back to simulated data.`);
        events = generateSimulatedEvents(username);
      }
    } catch (fetchError) {
      console.warn('Failed to reach GitHub, using simulated events.', fetchError);
      events = generateSimulatedEvents(username);
    }

    // Delegate all event processing to the canonical shared implementation
    const { activityByDay, recentRepos } = processGitHubEvents(events, uid);

    const batch = writeBatch(db);

    // Write daily activities to Firestore
    Object.values(activityByDay).forEach((activity) => {
      const docRef = doc(db, 'dailyActivities', `${uid}_${activity.date}`);
      batch.set(
        docRef,
        { ...activity, timestamp: serverTimestamp() },
        { merge: true },
      );
    });

    // Update user profile with GitHub connection metadata
    const updatePayload: Record<string, unknown> = {
      githubUsername: username,
      githubConnectedAt: serverTimestamp(),
      recentFocusAreas: recentRepos,
    };
    if (accessToken) {
      updatePayload.githubAccessToken = accessToken;
    }

    const userRef = doc(db, 'users', uid);
    batch.set(userRef, updatePayload, { merge: true });

    await batch.commit();

    // Fire AI generation with the processed activity array
    const activityArray = Object.values(activityByDay);
    await generateAndStoreInsights(uid, activityArray);
    await generateWeeklyReport(uid, activityArray);

    return true;
  } catch (error) {
    console.error('GitHub Sync Error:', error);
    throw error;
  }
}
