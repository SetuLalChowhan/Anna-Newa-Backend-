import express from "express";
import {
  getSystemInfo,
  createSystemInfo,
  updateSystemInfo,
} from "../controllers/systemInfoController.js";
import { protect, authorize } from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.get("/", getSystemInfo);
router.post(
  "/",
  protect,
  authorize("admin", "super-admin"),
  upload.single("logo"),
  createSystemInfo
);
router.put(
  "/",
  protect,
  authorize("admin", "super-admin"),
  upload.single("logo"),
  updateSystemInfo
);

export default router;
