import express from "express";
import { authorize, protect } from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import {
  createArticle,
  deleteArticle,
  getAllArticles,
  getArticle,
  updateArticle,
} from "../controllers/articleController.js";

const router = express.Router();
router.post(
  "/",
  protect,
  authorize("admin"),
  upload.fields([
    { name: "cover_image", maxCount: 1 },
    { name: "images", maxCount: 5 },
  ]),
  createArticle
);
router.get("/", getAllArticles);

router.get("/:slug", getArticle);

router.put(
  "/:id",
  protect,
  authorize("admin"),
  upload.fields([
    { name: "cover_image", maxCount: 1 },
    { name: "images", maxCount: 5 },
  ]),
  updateArticle
);

router.delete("/:id", protect, authorize("admin"), deleteArticle);
export default router;
