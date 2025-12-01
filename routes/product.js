import express from "express";
import {
  createProduct,
  getMyProducts,
  getProductsForBuyer,
  getProductsForSeller,
  getProduct,
  updateMyProduct,
  deleteMyProduct,

  getAdminProducts,
  getAllProducts,
} from "../controllers/productController.js";
import { protect, authorize } from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import { acceptBid, getMyBids, getMyWins, getProductWithBids, placeBid } from "../controllers/bidController.js";

const router = express.Router();

// Public routes

// Protected routes - Personal products (both roles)
router.post("/", protect, upload.array("images", 5), createProduct);
router.get("/for-buyer", protect, getProductsForBuyer);
router.get("/for-seller", protect, getProductsForSeller);
router.get("/all-products", getAllProducts);
router.get("/my-products", protect, getMyProducts);
router.get("/my-wins", protect, getMyWins);
router.get("/my-bids/history", protect, getMyBids);
router.put(
  "/my-products/:id",
  protect,
  upload.array("images", 5),
  updateMyProduct
);
router.delete("/my-products/:id", protect, deleteMyProduct);
router.get("/:slug", getProduct);

router.post("/:id/bid", protect, placeBid);
router.put("/:productId/accept-bid/:bidId", protect, acceptBid);
router.get("/:id/with-bids", protect, getProductWithBids);

export default router;
