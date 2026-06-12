import OpenAI from "openai";

export function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || "gpt-5.5";
}
