import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, subDays } from 'date-fns';

// Groq API (free, fast LLM inference)
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callGroq(prompt: string): Promise<string> {
    const apiKey = import.meta.env.VITE_GROK_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GROK_API_KEY_HERE') {
        throw new Error('VITE_GROK_API_KEY is not set in your .env file.');
    }

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [
                {
                    role: 'system',
                    content: `You are DevInsight, an elite AI performance coach for software engineers.
Write in a storytelling, narrative style — like a brilliant mentor who speaks directly to the developer.
Use specific numbers from the data. Be encouraging but honest. Surface real patterns and risks.
Always respond with valid JSON only. No markdown code fences, no explanation outside JSON.`
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.55,
            max_tokens: 1400,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from Groq API');
    return text;
}

export async function generateWeeklyReport(uid: string, activities: any[]) {
    if (!activities || activities.length === 0) return;

    const totalCommits = activities.reduce((sum, a) => sum + (a.commits || 0), 0);
    const totalDeepWork = activities.reduce((sum, a) => sum + (a.deepWorkHours || 0), 0);
    const totalLateNight = activities.reduce((sum, a) => sum + (a.lateNightCommits || 0), 0);
    const totalWeekend = activities.reduce((sum, a) => sum + (a.weekendCommits || 0), 0);
    const productivityScore = totalCommits > 0 ? Math.min(100, Math.round((totalDeepWork * 2) + (totalCommits * 0.5))) : 0;

    let burnoutRiskStatus = 'Low';
    if (totalLateNight > 10 || totalWeekend > 15) burnoutRiskStatus = 'High';
    else if (totalLateNight > 4 || totalWeekend > 5) burnoutRiskStatus = 'Medium';

    // Compute week-over-week trend for prediction
    const sorted = [...activities].sort((a, b) => a.date?.localeCompare(b.date ?? '') ?? 0);
    const half = Math.floor(sorted.length / 2);
    const recentCommits = sorted.slice(half).reduce((s, a) => s + (a.commits || 0), 0);
    const priorCommits = sorted.slice(0, half).reduce((s, a) => s + (a.commits || 0), 0);
    const weeklyTrend = priorCommits > 0
        ? `${recentCommits >= priorCommits ? '+' : ''}${Math.round(((recentCommits - priorCommits) / priorCommits) * 100)}% vs prior period`
        : 'first tracked period';

    // Predict next week (simple linear projection)
    let nextWeekPrediction = '';
    let nextWeekPctChange = 0;
    if (sorted.length >= 7) {
        const n = Math.min(sorted.length, 14);
        const recent = sorted.slice(-n);
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        recent.forEach((a, i) => {
            sumX += i; sumY += (a.commits || 0);
            sumXY += i * (a.commits || 0); sumX2 += i * i;
        });
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
        const intercept = (sumY - slope * sumX) / n;
        const nextAvg = Math.max(0, intercept + slope * (n + 3.5));
        const currentAvg = sumY / n;
        nextWeekPctChange = currentAvg > 0 ? Math.round(((nextAvg - currentAvg) / currentAvg) * 100) : 0;
        nextWeekPrediction = `${nextWeekPctChange >= 0 ? '+' : ''}${nextWeekPctChange}% projected`;
    }

    const activeDays = activities.filter(a => (a.commits || 0) > 0).length;
    const consistency = activities.length > 0 ? Math.round((activeDays / activities.length) * 100) : 0;

    try {
        const prompt = `Generate a professional, storytelling-style weekly engineering performance report as JSON.

Developer stats this period:
- Total commits: ${totalCommits} (trend: ${weeklyTrend})
- Deep work hours (estimated): ${totalDeepWork.toFixed(1)}h
- Late-night commits (after 10pm): ${totalLateNight}
- Weekend commits: ${totalWeekend}
- Active days: ${activeDays} / ${activities.length} tracked (${consistency}% consistency)
- Productivity score: ${productivityScore}/100
- Burnout risk: ${burnoutRiskStatus}
- Next-week projection: ${nextWeekPrediction || 'insufficient data'}

Write in a coaching, narrative voice. Reference specific numbers. Be encouraging but honest about risks.
Structure as 3 paragraphs: (1) narrative overview of the week, (2) key pattern or insight with specific data, (3) forward-looking recommendation for next week.

Respond ONLY with this exact JSON:
{
  "summaryText": "Paragraph 1 (2-3 sentences about the week overview with specific numbers).\\n\\nParagraph 2 (2-3 sentences about the most important pattern or risk detected, with numbers).\\n\\nParagraph 3 (2-3 sentences with specific, actionable next-week recommendations referencing their schedule).",
  "headline": "One punchy 8-12 word headline summarizing this week (e.g. 'Consistent Output, But Mid-Week Fatigue is Building')",
  "keyWin": "One specific positive thing they accomplished this week in 10-15 words",
  "keyRisk": "One specific risk or concern for next week in 10-15 words",
  "productivityScore": ${productivityScore},
  "burnoutRiskStatus": "${burnoutRiskStatus}",
  "nextWeekForecast": "${nextWeekPrediction || 'Stable'}"
}`;

        const text = await callGroq(prompt);
        const report = JSON.parse(text);

        const newReportRef = doc(collection(db, 'reports'));
        await setDoc(newReportRef, {
            uid,
            summaryText: report.summaryText || 'Report generated successfully.',
            headline: report.headline || 'Weekly Engineering Performance Summary',
            keyWin: report.keyWin || null,
            keyRisk: report.keyRisk || null,
            productivityScore: report.productivityScore ?? productivityScore,
            burnoutRiskStatus: report.burnoutRiskStatus || burnoutRiskStatus,
            nextWeekForecast: report.nextWeekForecast || nextWeekPrediction || null,
            nextWeekPctChange,
            weekEnding: format(new Date(), 'MMM dd, yyyy'),
            timestamp: serverTimestamp()
        });

        console.log('✅ Storytelling weekly report generated via Groq');
    } catch (error) {
        console.error('Failed to generate report via Groq:', error);

        // Storytelling fallback
        const trendSentence = priorCommits > 0
            ? recentCommits >= priorCommits
                ? `Your output is trending upward — ${recentCommits} commits in the recent period vs ${priorCommits} prior.`
                : `Your output dipped slightly — ${recentCommits} commits recently vs ${priorCommits} in the prior period. This is normal and recoverable.`
            : '';

        const riskSentence = burnoutRiskStatus === 'High'
            ? `One pattern worth addressing: ${totalLateNight} late-night commits detected. Late-night coding is linked to higher bug rates and slower next-day output. Consider setting a hard IDE shutdown at 8:30 PM.`
            : burnoutRiskStatus === 'Medium'
            ? `A mild warning signal: ${totalLateNight} late-night commits and ${totalWeekend} weekend commits. Protect your recovery windows before this escalates.`
            : `Your work hours are healthy — minimal late-night and weekend commits detected, which strongly predicts sustainable output over the next quarter.`;

        const newReportRef = doc(collection(db, 'reports'));
        await setDoc(newReportRef, {
            uid,
            summaryText: `This week you shipped ${totalCommits} commits with approximately ${totalDeepWork.toFixed(1)} estimated deep work hours — a productivity score of ${productivityScore}/100. ${trendSentence}\n\n${riskSentence}\n\nFor next week: block your highest-energy 90-minute window (try 9:00–10:30 AM) as a no-interruption deep work session. Even if your commit count stays the same, the quality and focus depth will compound into measurable output gains over 4–6 weeks.`,
            headline: `${productivityScore >= 70 ? 'Strong Week' : productivityScore >= 40 ? 'Solid Progress' : 'Room to Grow'} — ${totalCommits} Commits, ${consistency}% Active Days`,
            keyWin: `${totalCommits} commits shipped with ${consistency}% daily consistency`,
            keyRisk: burnoutRiskStatus !== 'Low' ? `${totalLateNight} late-night commits may impact next-week energy` : 'Maintain your healthy work-hour boundaries',
            productivityScore,
            burnoutRiskStatus,
            nextWeekForecast: nextWeekPrediction || 'Stable',
            nextWeekPctChange,
            weekEnding: format(new Date(), 'MMM dd, yyyy'),
            timestamp: serverTimestamp()
        });
        console.log('✅ Storytelling fallback report saved without AI');
    }
}
