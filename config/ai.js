import OpenAI from "openai";
import "dotenv/config";

if (!process.env.OPEN_API_KEY) {
  console.error("CRITICAL ERROR: OPEN_API_KEY is missing in environment variables.");
}

const ai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export default ai;
