import { GoogleGenAI } from '@google/genai';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateAndStoreInsights(uid: string, activities: any[]) {
    if (!activities || activities.length === 0) return;

    try {
        const prompt = `
        You are DevInsight, an elite AI mentor for software engineers.
        Analyze the following daily activity data for a developer over the last 14 days and generate 3 compelling behavioral insights (one positive, one warning, one neutral).
        
        Data:
        ${JSON.stringify(activities, null, 2)}
        
        Provide the response STRICTLY as a JSON array of objects with this schema:
        [
          {
             "type": "positive" | "warning" | "neutral",
             "title": "Short title",
             "content": "Observation",
             "recommendation": "Actionable advice"
          }
        ]
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from Gemini");
        
        const insights = JSON.parse(text);

        for (const insight of insights) {
            const newInsightRef = doc(collection(db, 'insights'));
            await setDoc(newInsightRef, {
                uid,
                ...insight,
                createdAt: serverTimestamp()
            });
        }
        
    } catch (error) {
        console.error("Failed to generate AI insights", error);
    }
}
