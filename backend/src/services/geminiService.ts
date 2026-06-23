import { gemini } from "../lib/gemini";

export async function generateGeminiText(prompt: string): Promise<string | undefined> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  const response = await gemini.models.generateContent({
    model: model,
    contents: prompt,
  });

  if (response.text === undefined) {
    throw new Error("Gemini response text is undefined");
  }

  return response.text;
}

export function parseJsonFromGeminiText(text: string): unknown {
  const trimmed = text.trim();

  const cleaned = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}