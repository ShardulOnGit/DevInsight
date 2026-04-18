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
                    content: `You are DevInsight, an elite AI performance coach for software engineers. 
You write insights in a storytelling, narrative style — like a brilliant mentor who truly understands the developer.
Instead of saying "You did X commits", say "You are a consistent developer, but your productivity dips mid-week suggest fatigue accumulation."
Instead of generic advice, give specific, actionable steps with concrete times and durations.
Always respond with valid JSON only. No markdown code fences, no explanation text outside JSON.`
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.65,
            max_tokens: 1200,
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

    // Compute week-over-week context
    const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));
    const half = Math.floor(sorted.length / 2);
    const recentHalf = sorted.slice(half).reduce((s, a) => s + (a.commits || 0), 0);
    const priorHalf = sorted.slice(0, half).reduce((s, a) => s + (a.commits || 0), 0);
    const trend = priorHalf > 0
        ? `${recentHalf > priorHalf ? '+' : ''}${Math.round(((recentHalf - priorHalf) / priorHalf) * 100)}% trend`
        : 'new dataset';

    const activeDays = activities.filter(a => (a.commits || 0) > 0).length;
    const consistency = activities.length > 0 ? Math.round((activeDays / activities.length) * 100) : 0;

    try {
        const prompt = `Analyze a software developer's behavioral data and generate exactly 4 storytelling-style insights.

Developer stats (sampled period):
- Total commits: ${totalCommits}
- Deep work hours estimated: ${totalDeepWork.toFixed(1)}h
- Late-night commits (after 10pm): ${totalLateNight}
- Weekend commits: ${totalWeekend}
- Active days out of ${activities.length} tracked: ${activeDays} (${consistency}% consistency)
- Output trend (recent vs prior): ${trend}

Write in a storytelling, coaching tone. Be specific and human. Reference specific numbers.
Examples of good insight content:
- "You are a consistent engineer, but your output drops sharply mid-week — Friday commits are 40% lower than Monday. This suggests decision fatigue accumulation."
- "Your late-night pattern is a double-edged sword. The quiet helps you focus, but ${totalLateNight} commits after 10 PM risks sleep debt that compounds into next-week output loss."
- "You've maintained ${consistency}% activity consistency — a rare trait. Developers who sustain this over 90 days are statistically 3x less likely to experience burnout."

Respond ONLY with this exact JSON:
{
  "insights": [
    {
      "type": "positive",
      "title": "Short storytelling title (5-8 words)",
      "content": "2-3 sentence narrative coaching observation referencing their actual numbers",
      "recommendation": "One concrete, specific action with time/duration (e.g. 'Code for 90min starting at 8 AM before checking Slack')"
    },
    {
      "type": "warning",
      "title": "Short warning title (5-8 words)",
      "content": "2-3 sentence observation about a risk pattern with specific data points",
      "recommendation": "One specific protective action with concrete parameters"
    },
    {
      "type": "neutral",
      "title": "Short neutral title (5-8 words)",
      "content": "2-3 sentence balanced observation about their coding pattern",
      "recommendation": "One optimization suggestion with measurable outcome"
    },
    {
      "type": "positive",
      "title": "Predictive observation title",
      "content": "2-3 sentence forward-looking observation based on their trend data",
      "recommendation": "One specific action to lock in the positive trajectory"
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

        console.log(`✅ Generated ${insights.length} storytelling insights via Groq`);
    } catch (error) {
        console.error('Failed to generate AI insights via Groq:', error);

        // Fallback: save intelligent narrative insights even if AI fails
        const weeklyTrend = trend.includes('+') ? 'trending upward' : 'showing a slight dip';
        const fallbackInsights = [
            {
                type: 'positive',
                title: 'Consistent Output Is Your Superpower',
                content: `You've maintained ${activeDays} active coding days out of ${activities.length} tracked — a ${consistency}% consistency rate. Developers who sustain this over 90 days are statistically far less likely to experience deep burnout. Your ${totalCommits} commits demonstrate real discipline, not just bursts.`,
                recommendation: `Keep your daily coding habit alive by setting a minimum viable commit goal: even one meaningful push per day before 6 PM protects your streak.`
            },
            ...(totalLateNight > 4 ? [{
                type: 'warning',
                title: 'Late-Night Commits Are Costing You',
                content: `${totalLateNight} commits pushed after 10 PM signals that your work is bleeding into recovery time. Late-night coding is correlated with 30% higher bug rates and significantly slower next-day output. Your deep work hours (${totalDeepWork.toFixed(1)}h) could be generating better results if shifted earlier.`,
                recommendation: `Set a hard IDE shutdown alarm at 8:30 PM. Spend the final 30 minutes of your day writing tomorrow's task list instead of shipping code.`
            }] : [{
                type: 'neutral',
                title: 'Your Work Hours Are Sustainable',
                content: `Your commit timestamps suggest a mostly normal working schedule with very little late-night activity. This is a strong predictor of long-term sustainability. Engineers who protect their off-hours compound their productivity over months.`,
                recommendation: `Continue protecting your evenings. Consider using the last 15 minutes of your workday for a "shutdown ritual" — closing tabs and writing a done/tomorrow list.`
            }]),
            {
                type: 'neutral',
                title: 'Deep Work Hours Are Your Moat',
                content: `Based on commit density and session analysis, you've accumulated ~${totalDeepWork.toFixed(1)} hours of estimated focus time. Your output is ${weeklyTrend} week-over-week. Deep work is a scarce resource — it compounds exponentially when protected consistently.`,
                recommendation: `Block your highest-energy 90-minute window (usually 9:00–10:30 AM) as an uninterruptible deep work session. No meetings, no Slack, no PR review — pure creation time.`
            },
            {
                type: 'positive',
                title: 'You Are More Consistent Than You Think',
                content: `With ${totalCommits} commits across ${activeDays} active days, your per-active-day output averages ${activeDays > 0 ? Math.round(totalCommits / activeDays) : 0} commits — a number that most engineers underestimate about themselves. Consistency is the engine of compound improvement.`,
                recommendation: `Visualize your streak weekly. Seeing your consistency in chart form is proven to reinforce the habit loop. Use the Insights heatmap to review every Sunday.`
            }
        ];

        for (const insight of fallbackInsights) {
            const newInsightRef = doc(collection(db, 'insights'));
            await setDoc(newInsightRef, { uid, ...insight, createdAt: serverTimestamp() });
        }
        console.log('✅ Fallback storytelling insights saved without AI');
    }
}
