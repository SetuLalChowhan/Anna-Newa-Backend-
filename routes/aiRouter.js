import express from "express";
import { streamChatWithAI, getChatHistory } from "../controllers/aiController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All routes protected
router.use(protect);

// Streaming AI chat
router.post("/chat/stream", streamChatWithAI);

// Get chat history for logged-in user
router.get("/chat/history", getChatHistory);

export default router;
