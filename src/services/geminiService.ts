import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Groq API (free, fast LLM inference — matches gsk_ API key format)
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
                    content: 'You are DevInsight, an elite AI mentor for software engineers. Always respond with valid JSON only. No markdown code fences, no explanation text outside JSON.'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.5,
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

export async function generateAndStoreInsights(uid: string, activities: any[]) {
    if (!activities || activities.length === 0) return;

    const totalCommits = activities.reduce((sum, a) => sum + (a.commits || 0), 0);
    const totalDeepWork = activities.reduce((sum, a) => sum + (a.deepWorkHours || 0), 0);
    const totalLateNight = activities.reduce((sum, a) => sum + (a.lateNightCommits || 0), 0);
    const totalWeekend = activities.reduce((sum, a) => sum + (a.weekendCommits || 0), 0);

    try {
        const prompt = `Analyze a developer's activity data and generate exactly 3 behavioral insights.

Developer stats (last 14 days):
- Total commits: ${totalCommits}
- Deep work hours estimated: ${totalDeepWork.toFixed(1)}h
- Late-night commits (after 10pm): ${totalLateNight}
- Weekend commits: ${totalWeekend}

Respond ONLY with this exact JSON:
{
  "insights": [
    {
      "type": "positive",
      "title": "Short positive title",
      "content": "1-2 sentence observation about something going well",
      "recommendation": "One actionable tip to maintain or build on this"
    },
    {
      "type": "warning",
      "title": "Short warning title",
      "content": "1-2 sentence observation about a risk pattern",
      "recommendation": "One specific action to address this"
    },
    {
      "type": "neutral",
      "title": "Short neutral title",
      "content": "1-2 sentence neutral observation about their patterns",
      "recommendation": "One suggestion to optimize this pattern"
    }
  ]
}`;

        const text = await callGroq(prompt);
        const parsed = JSON.parse(text);
        const insights: any[] = Array.isArray(parsed) ? parsed : (parsed.insights ?? []);

        for (const insight of insights) {
            const newInsightRef = doc(collection(db, 'insights'));
            await setDoc(newInsightRef, {
                uid,
                type: insight.type || 'neutral',
                title: insight.title || 'Insight',
                content: insight.content || '',
                recommendation: insight.recommendation || '',
                createdAt: serverTimestamp()
            });
        }

        console.log(`✅ Generated ${insights.length} insights via Groq`);
    } catch (error) {
        console.error('Failed to generate AI insights via Groq:', error);

        // Fallback: save basic computed insights even if AI fails
        const fallbackInsights = [
            {
                type: 'positive',
                title: 'Active Coding Streak',
                content: `You made ${totalCommits} commits over the past two weeks with ${totalDeepWork.toFixed(1)} estimated deep work hours. Consistent output signals strong discipline.`,
                recommendation: 'Keep your daily commit habit — even small commits build momentum over time.'
            },
            ...(totalLateNight > 4 ? [{
                type: 'warning',
                title: 'Late-Night Commits Detected',
                content: `${totalLateNight} commits were pushed after 10 PM. Late-night coding may reduce code quality and increase burnout risk.`,
                recommendation: 'Try to complete focused coding by 9 PM and use evenings for planning or low-effort tasks.'
            }] : [{
                type: 'neutral',
                title: 'Healthy Work Hours',
                content: 'Your commit timestamps suggest a mostly normal working schedule without excessive late-night activity.',
                recommendation: 'Keep protecting your off-hours to sustain this healthy pattern.'
            }]),
            {
                type: 'neutral',
                title: 'Deep Work Estimation',
                content: `Based on commit density, you accumulated ~${totalDeepWork.toFixed(1)} hours of focused coding time. This metric grows as you push larger, more complex changesets.`,
                recommendation: 'Consider using Pomodoro or time-blocking to increase deep work sessions intentionally.'
            }
        ];

        for (const insight of fallbackInsights) {
            const newInsightRef = doc(collection(db, 'insights'));
            await setDoc(newInsightRef, { uid, ...insight, createdAt: serverTimestamp() });
        }
        console.log('✅ Fallback insights saved without AI');
    }
}
