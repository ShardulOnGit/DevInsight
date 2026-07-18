/**
 * @file shared/prompts.ts
 * @description Groq prompt builders + narrative fallbacks for DevInsight Guardian.
 *
 * The Decision object from decisions.ts flows into these builders, causing the
 * LLM prompts to change based on the agent's judgment — not just raw metrics.
 * This is why the output feels like a manager, not an analytics tool.
 *
 * All functions: pure, zero runtime deps, work in browser and Node.js.
 */

import type {
  ComputedMetrics,
  Decision,
  InsightData,
  ReportData,
  BurnoutRisk,
} from './types';

// ─── Insight Prompt Builder ───────────────────────────────────────────────────

/**
 * Builds the Groq prompt for generating 4 coaching insights.
 * The Decision object adjusts tone, focus, and coaching strategy.
 */
export function buildInsightPrompt(
  metrics: ComputedMetrics,
  decision: Decision,
): string {
  const {
    totalCommits, totalDeepWork, totalLateNight, totalWeekend,
    activeDays, totalTrackedDays, consistency, productivityScore,
    burnoutRiskStatus, trend, perActiveDayAverage,
  } = metrics;

  const urgencyDirective =
    decision.urgency === 'CRITICAL'
      ? 'PRIORITY: This developer shows signs of unsustainable work patterns. Open with this concern directly — do not bury it after positive points.'
      : decision.urgency === 'CELEBRATORY'
      ? 'This developer is performing exceptionally. Open with genuine acknowledgement before any recommendations.'
      : '';

  const memoryContext = decision.acknowledgement
    ? `\nContext from yesterday: "${decision.acknowledgement}" — Reference this progress naturally in one of your insights.`
    : '';

  const strategyNote = decision.strategyShift
    ? '\nIMPORTANT: Previous coaching on the primary issue did not improve the metric. Change your approach — try a different angle, frame it differently, address a root cause rather than the surface behavior.'
    : '';

  const topRec = decision.recommendations[0];
  const topRecContext = topRec
    ? `\nThe single most important recommendation for today: "${topRec.action}" (confidence: ${topRec.confidence}%, reason: ${topRec.reason})`
    : '';

  return `You are an AI Engineering Manager writing coaching insights to a software developer.
${urgencyDirective}${memoryContext}${strategyNote}${topRecContext}

Developer activity data (last ${totalTrackedDays} days):
- Total commits: ${totalCommits} (${perActiveDayAverage} per active day, ${trend})
- Deep work hours estimated: ${totalDeepWork.toFixed(1)}h
- Late-night commits (after 10 PM): ${totalLateNight}
- Weekend commits: ${totalWeekend}
- Active days: ${activeDays}/${totalTrackedDays} (${consistency}% consistency)
- Productivity score: ${productivityScore}/100
- Burnout risk: ${burnoutRiskStatus}
- Today's coaching focus: ${decision.focus}

Write exactly 4 insights as a manager who has been watching this developer's patterns.
Do NOT write like a dashboard. Do NOT say "Your productivity score is X/100."
Instead say "I've been looking at your last two weeks and something stands out."
Reference specific numbers naturally, not as labels.

Respond ONLY with this exact JSON:
{
  "insights": [
    {
      "type": "${burnoutRiskStatus === 'High' ? 'warning' : 'positive'}",
      "title": "5-8 words that a manager would say, not a metric name",
      "content": "2-3 sentences in manager voice. Start with an observation, not a stat. Reference their numbers as evidence, not the headline.",
      "recommendation": "One concrete action with specific time/parameters. Sound like genuine advice, not a procedure."
    },
    {
      "type": "warning",
      "title": "5-8 word title about a risk the manager is watching",
      "content": "2-3 sentences. Be honest but not alarmist. Name the risk and its consequence.",
      "recommendation": "One protective action the developer can take today."
    },
    {
      "type": "neutral",
      "title": "5-8 word observation about a behavioral pattern",
      "content": "2-3 sentences about a pattern worth being aware of.",
      "recommendation": "One optimization that creates a measurable outcome."
    },
    {
      "type": "positive",
      "title": "5-8 word acknowledgement of their strongest quality",
      "content": "2-3 sentences genuinely acknowledging something they are doing well. Be specific — do not use generic praise.",
      "recommendation": "One action to amplify this strength further."
    }
  ]
}`;
}

// ─── Report Prompt Builder ────────────────────────────────────────────────────

/**
 * Builds the Groq prompt for the weekly engineering performance report.
 * Written in the voice of a manager preparing 1:1 notes.
 */
export function buildReportPrompt(
  metrics: ComputedMetrics,
  decision: Decision,
): string {
  const {
    totalCommits, totalDeepWork, totalLateNight, totalWeekend,
    activeDays, totalTrackedDays, consistency, productivityScore,
    burnoutRiskStatus, weeklyTrend, nextWeekPrediction,
  } = metrics;

  const acknowledgeContext = decision.acknowledgement
    ? `\nNote: "${decision.acknowledgement}" — Work this into your summary naturally.`
    : '';

  const topRecActions = decision.recommendations
    .map((r, i) => `${i + 1}. [${r.priority}] ${r.action} (confidence: ${r.confidence}%)`)
    .join('\n');

  return `You are an AI Engineering Manager writing your weekly notes before a 1:1 with a developer.
Write as if you are preparing talking points — direct, evidence-based, caring.${acknowledgeContext}

Period data (${totalTrackedDays} tracked days):
- Total commits: ${totalCommits} (${weeklyTrend})
- Deep work hours estimated: ${totalDeepWork.toFixed(1)}h
- Late-night commits (after 10 PM): ${totalLateNight}
- Weekend commits: ${totalWeekend}
- Active days: ${activeDays}/${totalTrackedDays} (${consistency}%)
- Productivity score: ${productivityScore}/100
- Burnout risk: ${burnoutRiskStatus}
- Next week forecast: ${nextWeekPrediction || 'insufficient data'}

Coaching priorities this week (in order):
${topRecActions || 'No critical issues — reinforce current trajectory'}

Write 3 paragraphs:
  Para 1: Your honest read of this week — what stood out, what you want to acknowledge.
  Para 2: The pattern or risk worth a real conversation. Be specific about the data.
  Para 3: Your coaching plan for next week. What you want them to focus on. Be direct.

Use language like: "I noticed", "I'm watching", "I'd want you to", "what I see is"
Sound like a manager, not a dashboard.

Respond ONLY with this exact JSON:
{
  "summaryText": "Three paragraphs separated by \\n\\n. Manager voice throughout.",
  "headline": "8-12 words a manager would say — not a metric readout. E.g. 'Strong week, but the late-night pattern needs a conversation'",
  "keyWin": "One specific, genuine achievement in 10-15 words",
  "keyRisk": "One specific risk the manager is watching — 10-15 words",
  "productivityScore": ${productivityScore},
  "burnoutRiskStatus": "${burnoutRiskStatus}",
  "nextWeekForecast": "${nextWeekPrediction || 'Stable'}"
}`;
}

// ─── Fallback Insight Generator ───────────────────────────────────────────────

/**
 * Generates narrative fallback insights when Groq API is unavailable.
 * Uses Decision context to maintain coaching consistency even without LLM.
 */
export function buildFallbackInsights(
  metrics: ComputedMetrics,
  decision: Decision,
): Omit<InsightData, 'uid' | 'createdAt'>[] {
  const {
    totalCommits, activeDays, totalTrackedDays, consistency,
    totalDeepWork, totalLateNight, trend, perActiveDayAverage,
  } = metrics;

  const weeklyTrend = trend.includes('+')
    ? 'trending upward'
    : 'showing a slight dip';

  const acknowledgementOpener = decision.acknowledgement
    ? `${decision.acknowledgement} ` 
    : '';

  const topBurnoutRec = decision.recommendations.find(r => r.category === 'burnout');
  const topProductivityRec = decision.recommendations.find(r => r.category === 'productivity');
  const topConsistencyRec = decision.recommendations.find(r => r.category === 'consistency');

  const insights: Omit<InsightData, 'uid' | 'createdAt'>[] = [
    {
      type: 'positive',
      title: 'You Show Up — That Is Half the Battle',
      content: `${acknowledgementOpener}I'm looking at ${activeDays} active days out of ${totalTrackedDays} tracked — ${consistency}% consistency. That's not something most engineers sustain. ${totalCommits} commits with an average of ${perActiveDayAverage} per active day tells me you're not coasting.`,
      recommendation:
        topConsistencyRec?.action ??
        'Keep your coding habit alive by setting a minimum commit goal: one meaningful push before 6 PM each day protects your streak.',
    },
    ...(totalLateNight > 4
      ? [
          {
            type: 'warning' as const,
            title: "The Late-Night Pattern Is Something I'm Watching",
            content: `${totalLateNight} commits after 10 PM tells me work is bleeding into recovery time. I've seen this pattern before — it feels productive, but late-night code carries 30% more bugs and slows the following day's output significantly. Your ${totalDeepWork.toFixed(1)} deep work hours could compound more effectively if shifted earlier.`,
            recommendation:
              topBurnoutRec?.action ??
              'Set a hard IDE shutdown alarm at 8:30 PM. Use the final 30 minutes to write tomorrow\'s task list instead of shipping code.',
          },
        ]
      : [
          {
            type: 'neutral' as const,
            title: 'Your Working Hours Are Sustainable',
            content:
              "Minimal late-night commits — this tells me you're protecting your off-hours. Engineers who do this consistently compound their output over months while others burn out. It's a stronger signal than it looks on the surface.",
            recommendation:
              'Continue protecting your evenings. Add a 15-minute shutdown ritual — close tabs, write a done/tomorrow list. It anchors the boundary.',
          },
        ]),
    {
      type: 'neutral',
      title: 'Deep Work Is Your Compound Interest',
      content: `Roughly ${totalDeepWork.toFixed(1)} estimated hours of focused work and your output is ${weeklyTrend} week-over-week. Deep work is the most undervalued engineering resource — it's where the real value gets built, and it compounds in ways that scattered commits don't.`,
      recommendation:
        topProductivityRec?.action ??
        'Block your peak 90-minute window (typically 9–10:30 AM) as a no-interruptions zone. No meetings, no Slack, no PR reviews during that window.',
    },
    {
      type: 'positive',
      title: 'You Are More Consistent Than You Realize',
      content: `${perActiveDayAverage} commits per active day is your real velocity — most engineers significantly underestimate this about themselves. Consistency at this level is rare and it compounds over time in ways that sudden productivity sprints don't.`,
      recommendation:
        'Visualize your streak weekly. Review the Insights heatmap every Sunday — seeing consistency in chart form reinforces the habit loop.',
    },
  ];

  return insights;
}

// ─── Fallback Report Generator ────────────────────────────────────────────────

/**
 * Generates a manager-voice fallback report when Groq API is unavailable.
 */
export function buildFallbackReport(
  metrics: ComputedMetrics,
  decision: Decision,
): Omit<ReportData, 'uid' | 'timestamp' | 'nextWeekPctChange' | 'weekEnding'> {
  const {
    totalCommits, totalDeepWork, consistency, productivityScore,
    burnoutRiskStatus, totalLateNight, weeklyTrend, nextWeekPrediction,
    activeDays, totalTrackedDays,
  } = metrics;

  const acknowledgement = decision.acknowledgement ? `${decision.acknowledgement}\n\n` : '';

  const riskSentence: Record<BurnoutRisk, string> = {
    High: `One pattern I want to flag directly: ${totalLateNight} late-night commits. This is the kind of signal I'd bring into a 1:1 immediately. Late coding correlates with lower next-week output and higher defect rates. I'd want this addressed before it becomes a sprint reliability issue.`,
    Medium: `Mild warning signal — ${totalLateNight} late-night commits detected. Not critical yet, but worth a conversation about protecting recovery windows before this becomes a pattern.`,
    Low: `Work-hour distribution looks healthy. Minimal late-night and weekend commits, which is a strong predictor of sustained, high-quality output quarter over quarter.`,
  };

  const trendSentence = weeklyTrend.includes('+')
    ? `Output is trending positively — ${weeklyTrend.replace('vs prior period', 'compared to the prior period')}.`
    : `Output dipped slightly this period, which is normal. What I'm watching is whether this is a one-off or the beginning of a pattern.`;

  const topRec = decision.recommendations[0];

  return {
    summaryText: `${acknowledgement}I'm looking at ${totalCommits} commits across ${activeDays} of ${totalTrackedDays} tracked days — roughly ${totalDeepWork.toFixed(1)} hours of estimated deep work, which gives a productivity score of ${productivityScore}/100. ${trendSentence}\n\n${riskSentence[burnoutRiskStatus]}\n\nFor next week: ${topRec?.action ?? 'protect your highest-energy 90-minute window (try 9:00–10:30 AM) as a no-interruption deep work session. Even if your commit count stays the same, the quality and focus depth will compound into measurable gains over 4–6 weeks.'}`,
    headline:
      `${productivityScore >= 70 ? 'Strong week' : productivityScore >= 40 ? 'Solid progress' : "Let's talk about this week"} — ${totalCommits} commits, ${consistency}% active days`,
    keyWin: `${totalCommits} commits shipped with ${consistency}% daily consistency over ${totalTrackedDays} days`,
    keyRisk:
      burnoutRiskStatus !== 'Low'
        ? `${totalLateNight} late-night commits — a trajectory worth watching closely`
        : 'Maintaining healthy work-hour boundaries — keep protecting this',
    productivityScore,
    burnoutRiskStatus,
    nextWeekForecast: nextWeekPrediction || 'Stable',
  };
}
