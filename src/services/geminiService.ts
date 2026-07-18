/**
 * @file src/services/geminiService.ts
 * @description Frontend AI insights service — thin wrapper over shared modules.
 *
 * PUBLIC API UNCHANGED: generateAndStoreInsights(uid, activities) → Promise<void>
 * All prompt logic lives in shared/prompts.ts.
 * All metric computation lives in shared/metrics.ts.
 * All decision logic lives in shared/decisions.ts.
 * All Groq API calls use shared/groq.ts.
 *
 * This file is responsible for:
 *   - Providing the Groq API key from Vite environment
 *   - Writing insights to Firestore via Firebase Web SDK
 */

import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { computeMetrics } from '@shared/metrics';
import { decide } from '@shared/decisions';
import { buildInsightPrompt, buildFallbackInsights } from '@shared/prompts';
import { callGroq } from '@shared/groq';
import type { DailyActivity, InsightData } from '@shared/types';

/**
 * Generates AI coaching insights from activity data and stores them in Firestore.
 * Uses the DECIDE stage to produce a Decision that shapes the Groq prompt.
 * Falls back to narrative insights if the Groq API is unavailable.
 *
 * Called from: githubSync.ts (after every GitHub sync)
 */
export async function generateAndStoreInsights(
  uid: string,
  activities: DailyActivity[],
): Promise<void> {
  if (!activities || activities.length === 0) return;

  const metrics = computeMetrics(activities);
  // Frontend has no memory context (memory is a Lambda-only feature)
  const decision = decide(metrics, null, null);
  const prompt = buildInsightPrompt(metrics, decision);

  let insights: Omit<InsightData, 'uid' | 'createdAt'>[] = [];

  try {
    const apiKey = import.meta.env.VITE_GROK_API_KEY as string;
    const text = await callGroq(prompt, apiKey);
    const parsed = JSON.parse(text) as { insights?: InsightData[] };
    const raw = Array.isArray(parsed) ? parsed : (parsed.insights ?? []);
    insights = raw.map(i => ({
      type: i.type ?? 'neutral',
      title: i.title ?? 'Insight',
      content: i.content ?? '',
      recommendation: i.recommendation ?? '',
    }));
  } catch (error) {
    console.error(
      'DevInsight Guardian: Groq API unavailable, using narrative fallback.',
      error,
    );
    insights = buildFallbackInsights(metrics, decision);
  }

  for (const insight of insights) {
    const docRef = doc(collection(db, 'insights'));
    await setDoc(docRef, { uid, ...insight, createdAt: serverTimestamp() });
  }

  console.log(`✅ DevInsight Guardian: ${insights.length} insights stored for user ${uid}`);
}
