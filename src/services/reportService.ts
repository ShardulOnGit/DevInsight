/**
 * @file src/services/reportService.ts
 * @description Frontend weekly report service — thin wrapper over shared modules.
 *
 * PUBLIC API UNCHANGED: generateWeeklyReport(uid, activities) → Promise<void>
 * All prompt logic lives in shared/prompts.ts.
 * All metric computation lives in shared/metrics.ts.
 * All decision logic lives in shared/decisions.ts.
 * All Groq API calls use shared/groq.ts.
 *
 * This file is responsible for:
 *   - Providing the Groq API key from Vite environment
 *   - Writing reports to Firestore via Firebase Web SDK
 */

import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../lib/firebase';
import { computeMetrics } from '@shared/metrics';
import { decide } from '@shared/decisions';
import { buildReportPrompt, buildFallbackReport } from '@shared/prompts';
import { callGroq } from '@shared/groq';
import type { DailyActivity, ReportData } from '@shared/types';

/**
 * Generates a weekly engineering performance report and stores it in Firestore.
 * Uses the DECIDE stage to produce a Decision that shapes the Groq prompt.
 * Falls back to narrative report if the Groq API is unavailable.
 *
 * Called from:
 *   - githubSync.ts (after every GitHub sync)
 *   - ReportsPage (manual generate button)
 */
export async function generateWeeklyReport(
  uid: string,
  activities: DailyActivity[],
): Promise<void> {
  if (!activities || activities.length === 0) return;

  const metrics = computeMetrics(activities);
  // Frontend has no memory context (memory is a Lambda-only feature)
  const decision = decide(metrics, null, null);
  const prompt = buildReportPrompt(metrics, decision);

  let reportData: Omit<ReportData, 'uid' | 'timestamp'>;

  try {
    const apiKey = import.meta.env.VITE_GROK_API_KEY as string;
    const text = await callGroq(prompt, apiKey, {
      temperature: 0.55,
      maxTokens: 1400,
    });
    const report = JSON.parse(text) as Partial<ReportData>;
    reportData = {
      summaryText: report.summaryText ?? 'Report generated successfully.',
      headline: report.headline ?? 'Weekly Engineering Performance Summary',
      keyWin: report.keyWin ?? '',
      keyRisk: report.keyRisk ?? '',
      productivityScore: report.productivityScore ?? metrics.productivityScore,
      burnoutRiskStatus: report.burnoutRiskStatus ?? metrics.burnoutRiskStatus,
      nextWeekForecast: report.nextWeekForecast ?? metrics.nextWeekPrediction ?? 'Stable',
      nextWeekPctChange: metrics.nextWeekPctChange,
      weekEnding: format(new Date(), 'MMM dd, yyyy'),
    };
  } catch (error) {
    console.error(
      'DevInsight Guardian: Groq API unavailable, using narrative fallback.',
      error,
    );
    const fallback = buildFallbackReport(metrics, decision);
    reportData = {
      ...fallback,
      nextWeekPctChange: metrics.nextWeekPctChange,
      weekEnding: format(new Date(), 'MMM dd, yyyy'),
    };
  }

  const docRef = doc(collection(db, 'reports'));
  await setDoc(docRef, { uid, ...reportData, timestamp: serverTimestamp() });

  console.log(`✅ DevInsight Guardian: Weekly report stored for user ${uid}`);
}
