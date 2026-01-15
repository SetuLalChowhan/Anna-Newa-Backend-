import express from "express";
import {
  submitContactForm,
  getAllContacts,
} from "../controllers/contactController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.post("/", submitContactForm);
router.get("/", protect, authorize("admin", "super-admin"), getAllContacts);

export default router;
