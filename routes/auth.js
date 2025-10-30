import express from "express";
import {
  register,
  verifyEmail,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  updateProfilePicture,
  resendVerification,
  verifyResetCode,
  resendOTP,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-code", verifyResetCode);
router.post("/resend-otp", resendOTP);
router.post("/reset-password", resetPassword);
router.post("/resend-verification", resendVerification);

// Protected routes
router.post("/logout", logout);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put(
  "/profile/picture",
  protect,
  upload.single("profilePicture"),
  updateProfilePicture
);

export default router;
