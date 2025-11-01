import Order from "../models/Order.js";

export const getMyOrders = async (req, res) => {
  try {
    const {
      role,
      status,
      deliveryStatus,
      paymentStatus,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (role === "seller") {
      query.seller = req.user.id;
    } else if (role === "buyer") {
      query.buyer = req.user.id;
    } else {
      query.$or = [{ seller: req.user.id }, { buyer: req.user.id }];
    }

    if (status && status !== "all") query.orderStatus = status;
    if (deliveryStatus && deliveryStatus !== "all")
      query.deliveryStatus = deliveryStatus;
    if (paymentStatus && paymentStatus !== "all")
      query.paymentStatus = paymentStatus;

    const orders = await Order.find(query)
      .populate("product", "title images slug category")
      .populate("seller", "name email phone")
      .populate("buyer", "name email phone")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalOrders: total,
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate("product", "title images slug description category")
      .populate("seller", "name email phone address")
      .populate("buyer", "name email phone address");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isSeller = order.seller._id.toString() === req.user.id;
    const isBuyer = order.buyer._id.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isSeller && !isBuyer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    res.json({
      success: true,
      order,
      userRole: isSeller ? "seller" : isBuyer ? "buyer" : "admin",
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const {
      orderStatus,
      deliveryStatus,
      paymentStatus,
      notes,
      cancellationReason,
    } = req.body;

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can update order status",
      });
    }

    const updateData = {};

    if (orderStatus) {
      updateData.orderStatus = orderStatus;
      if (orderStatus === "Completed") {
        updateData.deliveredAt = new Date();
      } else if (orderStatus === "Cancelled") {
        updateData.cancelledAt = new Date();
        updateData.cancellationReason =
          cancellationReason || "Cancelled by admin";
      }
    }

    if (deliveryStatus) updateData.deliveryStatus = deliveryStatus;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (notes) updateData.notes = notes;

    if (deliveryStatus === "Delivered") {
      updateData.deliveredAt = new Date();
      updateData.orderStatus = "Completed";
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.orderId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("product", "title images slug")
      .populate("seller", "name email phone")
      .populate("buyer", "name email phone");

    res.json({
      success: true,
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateDeliveryStatus = async (req, res) => {
  try {
    const { deliveryStatus, trackingNumber, shippingProvider, notes } =
      req.body;

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // ✅ FIXED: Allow both ADMIN and SELLER (order owner)
    const isAdmin = req.user.role === "admin";
    const isSeller = order.seller.toString() === req.user.id;

    if (!isAdmin && !isSeller) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update delivery status for this order",
      });
    }

    const updateData = { deliveryStatus };

    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (shippingProvider) updateData.shippingProvider = shippingProvider;
    if (notes) updateData.notes = notes;

    if (deliveryStatus === "Delivered") {
      updateData.deliveredAt = new Date();
      updateData.orderStatus = "Completed";
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.orderId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("product", "title images slug")
      .populate("seller", "name email phone")
      .populate("buyer", "name email phone");

    res.json({
      success: true,
      message: "Delivery status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating delivery status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentStatus } = req.body;

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isSeller = order.seller.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update payment status",
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.orderId,
      { paymentStatus },
      { new: true, runValidators: true }
    )
      .populate("product", "title images slug")
      .populate("seller", "name email phone")
      .populate("buyer", "name email phone");

    res.json({
      success: true,
      message: "Payment status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const { cancellationReason } = req.body;

    const order = await Order.findById(req.params.orderId)
      .populate("seller", "name email")
      .populate("buyer", "name email");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isSeller = order.seller._id.toString() === req.user.id;
    const isBuyer = order.buyer._id.toString() === req.user.id;

    if (!isSeller && !isBuyer) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this order",
      });
    }

    if (
      order.orderStatus === "Completed" ||
      order.orderStatus === "Cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message: `Order is already ${order.orderStatus}`,
      });
    }

    if (order.deliveryStatus === "Delivered") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel delivered order",
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.orderId,
      {
        orderStatus: "Cancelled",
        deliveryStatus: "Cancelled",
        paymentStatus: "Refunded",
        cancelledAt: new Date(),
        cancellationReason:
          cancellationReason || `Cancelled by ${isSeller ? "seller" : "buyer"}`,
      },
      { new: true, runValidators: true }
    )
      .populate("product", "title images slug")
      .populate("seller", "name email phone")
      .populate("buyer", "name email phone");

    res.json({
      success: true,
      message: "Order cancelled successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addOrderReview = async (req, res) => {
  try {
    const { rating, review } = req.body;

    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.buyer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Only buyer can add review",
      });
    }

    if (order.orderStatus !== "Completed") {
      return res.status(400).json({
        success: false,
        message: "Can only review completed orders",
      });
    }

    if (order.rating) {
      return res.status(400).json({
        success: false,
        message: "Order already reviewed",
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.orderId,
      {
        rating,
        review,
        reviewedAt: new Date(),
      },
      { new: true, runValidators: true }
    )
      .populate("product", "title images slug")
      .populate("seller", "name email phone")
      .populate("buyer", "name email phone");

    res.json({
      success: true,
      message: "Review added successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const {
      status,
      deliveryStatus,
      paymentStatus,
      sellerId,
      buyerId,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    if (status && status !== "all") query.orderStatus = status;
    if (deliveryStatus && deliveryStatus !== "all")
      query.deliveryStatus = deliveryStatus;
    if (paymentStatus && paymentStatus !== "all")
      query.paymentStatus = paymentStatus;
    if (sellerId) query.seller = sellerId;
    if (buyerId) query.buyer = buyerId;

    const orders = await Order.find(query)
      .populate("product", "title images slug category")
      .populate("seller", "name email phone")
      .populate("buyer", "name email phone")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Order.countDocuments(query);

    // Get statistics
    const totalRevenue = await Order.aggregate([
      { $match: { orderStatus: "Completed" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      orders,
      statistics: {
        totalRevenue: totalRevenue[0]?.total || 0,
        orderStats,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalOrders: total,
      },
    });
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete orders",
      });
    }

    await Order.findByIdAndDelete(req.params.orderId);

    res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getOrderStats = async (req, res) => {
  try {
    // Total orders count
    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({
      orderStatus: "Completed",
    });
    const pendingOrders = await Order.countDocuments({
      orderStatus: "Processing",
    });
    const cancelledOrders = await Order.countDocuments({
      orderStatus: "Cancelled",
    });

    // 🎯 SIMPLE REVENUE CALCULATION - 2% COMMISSION
    const revenueStats = await Order.aggregate([
      { $match: { orderStatus: "Completed" } },
      {
        $group: {
          _id: null,
          // Total money moved through platform
          totalSales: { $sum: "$totalPrice" },

          // 🎯 COMPANY EARNINGS (2% of every order)
          totalCompanyRevenue: { $sum: "$companyRevenue" },

          // Total paid to sellers (98% of sales)
          totalSellerEarnings: { $sum: "$sellerEarning" },

          // Order counts
          totalCompletedOrders: { $sum: 1 },
          averageOrderValue: { $avg: "$totalPrice" },
        },
      },
    ]);

    const stats = revenueStats[0] || {
      totalSales: 0,
      totalCompanyRevenue: 0,
      totalSellerEarnings: 0,
      totalCompletedOrders: 0,
      averageOrderValue: 0,
    };

    // 🎯 MONTHLY EARNINGS (Last 6 months)
    const monthlyEarnings = await Order.aggregate([
      { $match: { orderStatus: "Completed" } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          monthlySales: { $sum: "$totalPrice" },
          monthlyRevenue: { $sum: "$companyRevenue" }, // 2% commission
          orders: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 6 },
    ]);

    // 🎯 TODAY'S EARNINGS
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStats = await Order.aggregate([
      {
        $match: {
          orderStatus: "Completed",
          createdAt: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: null,
          todaySales: { $sum: "$totalPrice" },
          todayRevenue: { $sum: "$companyRevenue" }, // 2% commission
          todayOrders: { $sum: 1 },
        },
      },
    ]);

    const todayData = todayStats[0] || {
      todaySales: 0,
      todayRevenue: 0,
      todayOrders: 0,
    };

    res.json({
      success: true,
      stats: {
        // 📊 BASIC COUNTS
        orders: {
          total: totalOrders,
          completed: completedOrders,
          pending: pendingOrders,
          cancelled: cancelledOrders,
        },

        // 💰 MONEY STATS
        earnings: {
          // Total money processed
          totalSales: stats.totalSales,

          // 🎯 COMPANY EARNINGS (2% commission)
          totalRevenue: stats.totalCompanyRevenue,

          // Paid to sellers (98%)
          totalPaidToSellers: stats.totalSellerEarnings,

          // Average order value
          averageOrder: stats.averageOrderValue,

          // Commission rate
          commissionRate: "2%",
        },

        // 📅 TODAY'S PERFORMANCE
        today: {
          sales: todayData.todaySales,
          revenue: todayData.todayRevenue, // 2% of today's sales
          orders: todayData.todayOrders,
        },

        // 📈 LAST 6 MONTHS
        monthly: monthlyEarnings.map((month) => ({
          year: month._id.year,
          month: month._id.month,
          sales: month.monthlySales,
          revenue: month.monthlyRevenue, // 2% commission
          orders: month.orders,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
