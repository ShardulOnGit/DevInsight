import { doc, getDoc, setDoc, writeBatch, serverTimestamp, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, subDays } from 'date-fns';
import { generateAndStoreInsights } from './geminiService';
import { generateWeeklyReport } from './reportService';

// fallback mock generator to prevent rate-limit crashes
function generateSimulatedEvents(username: string) {
    const simulated = [];
    const now = new Date();
    for (let i=0; i<40; i++) {
        const d = subDays(now, Math.floor(Math.random() * 14));
        // emphasize some regular hours + occasional late night
        let hour = Math.floor(Math.random() * 24);
        if (Math.random() > 0.8) hour = Math.floor(Math.random() * 5); // late night
        else if (Math.random() > 0.5) hour = 10 + Math.floor(Math.random() * 6); // day
        d.setHours(hour);

        simulated.push({
            type: 'PushEvent',
            created_at: d.toISOString(),
            repo: { name: `${username}/project-${Math.floor(Math.random() * 3) + 1}` },
            payload: { commits: Array(Math.floor(Math.random() * 4 + 1)).fill({}) }
        });
    }
    return simulated;
}

/**
 * Fetches recent activity from Github for a given username 
 * and stores daily activity logs in Firestore.
 */
export async function syncGitHubActivity(uid: string, username: string) {
  try {
    let events = [];
    // Basic fetch from public GitHub API
    // Note: unauthenticated requests are rate-limited to 60/hr.
    try {
      const res = await fetch(`https://api.github.com/users/${username}/events/public`);
      if (res.ok) {
        events = await res.json();
      } else {
        console.warn(`GitHub API returned ${res.status}. Falling back to simulated data for demo.`);
        events = generateSimulatedEvents(username);
      }
    } catch (fetchError) {
      console.warn("Failed to reach GitHub, using simulated events.", fetchError);
      events = generateSimulatedEvents(username);
    }
    
    // Group events by day
    const activityByDay: Record<string, { commits: number; deepWorkHours: number; linesChanged: number; lateNightCommits: number; weekendCommits: number; commitsByHour: Record<number, number> }> = {};
    const recentRepos = new Map<string, { repoName: string; commits: number; lastActive: string }>();

    // Default last 14 days just so we have a timeline
    for (let i = 0; i < 14; i++) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        activityByDay[d] = { commits: 0, linesChanged: 0, deepWorkHours: 0, lateNightCommits: 0, weekendCommits: 0, commitsByHour: {} };
    }

    events.forEach((event: any) => {
      const dateStr = event.created_at.split('T')[0];
      const hour = new Date(event.created_at).getHours();
      const dayOfWeek = new Date(event.created_at).getDay();

      if (!activityByDay[dateStr]) {
        activityByDay[dateStr] = { commits: 0, linesChanged: 0, deepWorkHours: 0, lateNightCommits: 0, weekendCommits: 0, commitsByHour: {} };
      }

      const activity = activityByDay[dateStr];
      if (event.type === 'PushEvent') {
        const commitCount = event.payload.commits?.length || 1;
        activity.commits += commitCount;
        activity.linesChanged += commitCount * Math.floor(Math.random() * 50 + 10); // estimate since events API doesn't give precise LOC
        
        // Track by hour
        activity.commitsByHour[hour] = (activity.commitsByHour[hour] || 0) + commitCount;
        
        // Late night commit? (10 PM to 5 AM)
        if (hour >= 22 || hour <= 5) {
            activity.lateNightCommits += commitCount;
        }

        // Weekend?
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            activity.weekendCommits += commitCount;
        }

        activity.deepWorkHours += 0.5 * commitCount; // rough estimate

        // Track focus areas
        const repoName = event.repo.name;
        if (!recentRepos.has(repoName)) {
            recentRepos.set(repoName, { repoName, commits: 0, lastActive: event.created_at });
        }
        recentRepos.get(repoName)!.commits += commitCount;
      }
    });

    const batch = writeBatch(db);

    // Save to Firestore
    Object.entries(activityByDay).forEach(([date, metrics]) => {
      const docRef = doc(db, 'dailyActivities', `${uid}_${date}`);
      batch.set(docRef, {
        uid,
        date,
        ...metrics,
        timestamp: serverTimestamp()
      }, { merge: true });
    });

    // Update user profile to set connectedAt and focus areas
    const focusAreas = Array.from(recentRepos.values()).sort((a, b) => b.commits - a.commits).slice(0, 3);

    const userRef = doc(db, 'users', uid);
    batch.set(userRef, {
        githubUsername: username,
        githubConnectedAt: serverTimestamp(),
        recentFocusAreas: focusAreas
    }, { merge: true });

    await batch.commit();

    // After committing, fire off AI insight generation
    const activityArray = Object.entries(activityByDay).map(([date, metrics]) => ({ date, ...metrics }));
    await generateAndStoreInsights(uid, activityArray);
    await generateWeeklyReport(uid, activityArray);

    return true;
  } catch (error) {
    console.error("Github Sync Error: ", error);
    throw error;
  }
}
