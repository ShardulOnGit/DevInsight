import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';

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
                    content: 'You are DevInsight, a professional developer performance analytics tool. Always respond with valid JSON only. No markdown, no explanation outside JSON.'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.4,
            max_tokens: 1024,
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
    const productivityScore = totalCommits > 0 ? Math.min(100, Math.round((totalDeepWork * 2) + (totalCommits * 0.5))) : 0;

    let burnoutRiskStatus = 'Low';
    if (totalLateNight > 10) burnoutRiskStatus = 'High';
    else if (totalLateNight > 4) burnoutRiskStatus = 'Medium';

    try {
        const prompt = `Generate a professional weekly engineering performance report as a JSON object.
        
Developer stats this week:
- Total commits: ${totalCommits}
- Deep work hours (estimated): ${totalDeepWork.toFixed(1)}h
- Late-night commits (after 10pm): ${totalLateNight}
- Productivity score: ${productivityScore}/100
- Burnout risk: ${burnoutRiskStatus}

Respond ONLY with this exact JSON structure:
{
  "summaryText": "Write 2-3 paragraphs. Paragraph 1: overall activity summary. Paragraph 2: productivity highlights and patterns. Paragraph 3: specific actionable recommendations for next week. Be encouraging but honest.",
  "productivityScore": ${productivityScore},
  "burnoutRiskStatus": "${burnoutRiskStatus}"
}`;

        const text = await callGroq(prompt);
        const report = JSON.parse(text);

        const newReportRef = doc(collection(db, 'reports'));
        await setDoc(newReportRef, {
            uid,
            summaryText: report.summaryText || 'Report generated successfully.',
            productivityScore: report.productivityScore ?? productivityScore,
            burnoutRiskStatus: report.burnoutRiskStatus || burnoutRiskStatus,
            weekEnding: format(new Date(), 'MMM dd, yyyy'),
            timestamp: serverTimestamp()
        });

        console.log('✅ Weekly report generated via Groq');
    } catch (error) {
        console.error('Failed to generate report via Groq:', error);
        // Fallback: save a basic report with computed stats even if AI fails
        const newReportRef = doc(collection(db, 'reports'));
        await setDoc(newReportRef, {
            uid,
            summaryText: `Weekly Engineering Summary (Auto-generated)\n\nThis week you made ${totalCommits} commits with approximately ${totalDeepWork.toFixed(1)} deep work hours tracked across your repositories. Your productivity score is ${productivityScore}/100 and burnout risk is ${burnoutRiskStatus}.\n\nKeep up the consistent effort! Remember to take regular breaks and protect your off-hours to maintain sustainable velocity.`,
            productivityScore,
            burnoutRiskStatus,
            weekEnding: format(new Date(), 'MMM dd, yyyy'),
            timestamp: serverTimestamp()
        });
        console.log('✅ Fallback report saved without AI');
    }
}
