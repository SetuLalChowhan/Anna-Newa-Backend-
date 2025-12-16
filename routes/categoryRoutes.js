import express from "express";
const router = express.Router();
import { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory} from "../controllers/categoryController.js";

// Create category
router.post("/", createCategory);

// Get all categories
router.get("/", getAllCategories);

// Get single category
router.get("/:id", getCategoryById);

// Update category
router.put("/:id", updateCategory);

// Delete category
router.delete("/:id", deleteCategory);

export default router;
