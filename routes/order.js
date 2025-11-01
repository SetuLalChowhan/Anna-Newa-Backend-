import express from 'express';
import {

  getMyOrders,
  getOrder,
  updateOrderStatus,
  updateDeliveryStatus,
  updatePaymentStatus,
  cancelOrder,
  addOrderReview,
  getAllOrders,
  deleteOrder,
  getOrderStats
} from '../controllers/orderController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// ✅ FIXED: Put ADMIN routes BEFORE parameter routes
// Admin only routes
router.get('/admin/all', protect, authorize('admin'), getAllOrders);
router.get('/admin/stats', protect, authorize('admin'), getOrderStats);
router.delete('/admin/:orderId', protect, authorize('admin'), deleteOrder);

// Protected routes - Order management
// router.post('/create-from-bid', protect, createOrderFromBid);
router.get('/my-orders', protect, getMyOrders);
router.put('/:orderId/delivery-status', protect, authorize('admin'), updateDeliveryStatus);
router.put('/:orderId/payment-status', protect, updatePaymentStatus);
router.put('/:orderId/cancel', protect, cancelOrder);
router.put('/:orderId/review', protect, addOrderReview);
router.put('/:orderId/status', protect, authorize('admin'), updateOrderStatus);
router.get('/:orderId', protect, getOrder);

export default router;