import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
export const getDashboardStats = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const role = req.user.role;

    let stats = {
      role: role,
    };

    // --- SHARED DATA (Bids Placed by this user anywhere) ---
    const bidsPlacedAgg = await Product.aggregate([
      { $unwind: "$bids" },
      { $match: { "bids.user": userId } },
      { $count: "total" },
    ]);
    stats.totalBids = bidsPlacedAgg.length > 0 ? bidsPlacedAgg[0].total : 0;

    // --- SHARED DATA (Winning Bids - where user was a bidder and won) ---
    stats.winningBids = await Order.countDocuments({
      $or: [
        { buyer: userId, postType: "sell" }, // Won someone's sell post
        { seller: userId, postType: "buy" }, // Won someone's buy post
      ],
      orderStatus: "Completed",
    });

    if (role === "seller") {
      // Total Products Created (Sell posts)
      stats.totalProducts = await Product.countDocuments({
        user: userId,
        status: { $in: ["active", "sold", "purchased"] },
      });

      // Active Products
      stats.activeProducts = await Product.countDocuments({
        user: userId,
        status: "active",
      });

      // Completed Orders (as Seller - either own post or winning a buy post)
      stats.completedOrders = await Order.countDocuments({
        seller: userId,
        orderStatus: "Completed",
      });

      // Total Income (User's earning after platform commission)
      const revenueAgg = await Order.aggregate([
        {
          $match: {
            seller: userId,
            orderStatus: "Completed",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$sellerEarning" },
          },
        },
      ]);
      stats.totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

      // Recent Orders (Mix of selling and buying)
      stats.recentOrders = await Order.find({
        $or: [{ seller: userId }, { buyer: userId }],
      })
        .populate("buyer seller", "name email")
        .populate("product", "title images")
        .sort({ createdAt: -1 })
        .limit(5);
    } else if (role === "buyer") {
      // Total Products Created (Buy requests)
      stats.totalProducts = await Product.countDocuments({
        user: userId,
        status: { $in: ["active", "sold", "purchased"] },
      });

      // Completed Orders (as Buyer - either own post or winning a sell post)
      stats.completedOrders = await Order.countDocuments({
        buyer: userId,
        orderStatus: "Completed",
      });

      // Total Spent (Total price paid by buyer)
      const spentAgg = await Order.aggregate([
        {
          $match: {
            buyer: userId,
            orderStatus: "Completed",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalPrice" },
          },
        },
      ]);
      stats.totalSpent = spentAgg.length > 0 ? spentAgg[0].total : 0;

      // Recent Orders (Mix of selling and buying)
      stats.recentOrders = await Order.find({
        $or: [{ seller: userId }, { buyer: userId }],
      })
        .populate("seller buyer", "name email")
        .populate("product", "title images")
        .sort({ createdAt: -1 })
        .limit(5);
    }

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
