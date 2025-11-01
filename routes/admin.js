import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAllProducts,
  deleteProduct,
  getDashboardStats,
  updateProductStatus,
} from "../controllers/adminController..js";
import { protect, authorize } from "../middleware/auth.js";
import { deleteOrder, getOrderStats } from "../controllers/orderController.js";

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(authorize("admin"));
router.get("/stats", getOrderStats);

router.get("/dashboard", getDashboardStats);
router.get("/products", getAllProducts);

router.get("/users", getAllUsers);
router.get("/users/:userId", getUserById);
router.put("/users/:userId", updateUser);
router.delete("/users/:userId", deleteUser);
router.delete("/:orderId", deleteOrder);

router.delete("/products/:productId", deleteProduct);
router.put("/products/:productId/status", updateProductStatus);

export default router;
