import "dotenv/config";
import ai from "../config/ai.js";

const verifyConnection = async () => {
  console.log("Testing AI connection...");
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is missing from environment variables.");
    process.exit(1);
  }

  try {
    const response = await ai.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "Hello, can you hear me?" }],
      stream: false,
    });

    console.log("✅ AI Connection Successful!");
    console.log("Response:", response.choices[0].message.content);
  } catch (error) {
    console.error("❌ AI Connection Failed:");
    console.error(error);
  }
};

verifyConnection();
