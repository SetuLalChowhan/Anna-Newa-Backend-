import ai from "../config/ai.js"; 
import Chat from "../models/AiChat.js"; 

// In-memory memory (for demonstration)
const conversationMemory = {};

// STREAM AI CHAT
export const streamChatWithAI = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ Get user ID from protect middleware
    const { message } = req.body;

    if (!message) return res.status(400).json({ success: false, message: "Message is required" });

    if (!conversationMemory[userId]) conversationMemory[userId] = [];
    conversationMemory[userId].push({ role: "user", content: message });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders();

    const response = await ai.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: conversationMemory[userId],
      stream: true,
    });

    let aiReply = "";

    for await (const event of response) {
      const delta = event.choices[0].delta?.content;
      if (delta) {
        aiReply += delta;
        res.write(`data: ${delta}\n\n`);
      }
    }

    res.write("event: end\n");
    res.write("data: [DONE]\n\n");
    res.end();

    conversationMemory[userId].push({ role: "assistant", content: aiReply });

    await Chat.create({ userId, userMessage: message, aiReply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// GET CHAT HISTORY
export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ Get user ID from protect middleware

    // Fetch all chats for this user, oldest first for conversation flow
    const chats = await Chat.find({ userId }).sort({ createdAt: 1 });

    res.status(200).json({ success: true, chats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
