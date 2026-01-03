import express from "express";
import {  chatWithAI, getChatHistory } from "../controllers/aiController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All routes protected
router.use(protect);

// Streaming AI chat
router.post("/chat", chatWithAI );

// Get chat history for logged-in user
router.get("/chat/history", getChatHistory);

export default router;
