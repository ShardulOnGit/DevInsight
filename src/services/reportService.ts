import { GoogleGenAI } from '@google/genai';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateWeeklyReport(uid: string, activities: any[]) {
    if (!activities || activities.length === 0) return;

    try {
        const prompt = `
        You are DevInsight, reporting on a developer's activity over the last 1-2 weeks.
        Generate a professional, encouraging weekly summary report based on this activity data.
        
        Data:
        ${JSON.stringify(activities, null, 2)}
        
        Provide the response STRICTLY as a JSON object with this schema:
        {
          "summaryText": "A 2-3 paragraph professional summary of the developer's work pattern, productivity highlights, and recommendations.",
          "productivityScore": "number out of 100",
          "burnoutRiskStatus": "'Low', 'Medium', or 'High'"
        }
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
        
        const report = JSON.parse(text);

        const newReportRef = doc(collection(db, 'reports'));
        await setDoc(newReportRef, {
            uid,
            ...report,
            weekEnding: format(new Date(), 'MMM dd, yyyy'),
            timestamp: serverTimestamp()
        });
        
    } catch (error) {
        console.error("Failed to generate report", error);
    }
}
