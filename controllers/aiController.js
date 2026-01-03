import ai from "../config/ai.js"; 
import Chat from "../models/AiChat.js"; 

// In-memory memory (for demonstration)
const conversationMemory = {};

/**
 * NORMAL AI CHAT (Non-Streaming)
 */
export const chatWithAI = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    // 1. Initialize or update conversation memory
    if (!conversationMemory[userId]) {
      conversationMemory[userId] = [
        {
          role: "system",
          content: `You are a helpful assistant for the Annanewa platform. Annanewa is a direct-to-consumer farming marketplace connecting farmers (sellers) and buyers directly, eliminating middlemen. 
          
          Platform Features:
          - Buyers post product needs, Sellers bid on them.
          - Sellers post products, Buyers bid on them.
          - Bidding is not real-time; it's a "best price" offer system.
          - Users arrange delivery (trucks) and payment (cash on hand) offline after acceptance.
          - There is an Article section where Admins post farming-related articles.
          
          Your Role:
          - Assist users with platform-related queries (bidding, posting, browsing).
          - Answer questions about farming, agriculture, and crops.
          - Refuse to answer questions UNRELATED to Annanewa, farming, agriculture, or the platform.
          
          If a user asks about an unrelated topic (e.g., politics, coding, movies), politely decline and remind them that you are the Annanewa assistant.`
        }
      ];
    }
    conversationMemory[userId].push({ role: "user", content: message });

    // 2. Call AI without streaming
    const response = await ai.chat.completions.create({
      model: "gemini-2.5-flash", // Ensure fallback model exists
      messages: conversationMemory[userId],
      stream: false, // Explicitly set to false
    });

    const aiReply = response.choices[0].message.content;

    // 3. Store AI reply in memory for context in next turn
    conversationMemory[userId].push({ role: "assistant", content: aiReply });

    // 4. Save the interaction to the Database
    await Chat.create({ 
      userId, 
      userMessage: message, 
      aiReply 
    });

    // 5. Send full JSON response to frontend
    res.status(200).json({ 
      success: true, 
      reply: aiReply 
    });

  } catch (error) {
    console.error("AI Controller Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Something went wrong while communicating with AI" 
    });
  }
};

/**
 * GET CHAT HISTORY
 */
export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all chats for this user, oldest first
    const chats = await Chat.find({ userId }).sort({ createdAt: 1 });

    res.status(200).json({ 
      success: true, 
      chats 
    });
  } catch (error) {
    console.error("Get History Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Could not retrieve chat history" 
    });
  }
};