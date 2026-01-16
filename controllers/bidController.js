import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose, { isValidObjectId } from "mongoose";
import Order from "../models/Order.js";
import { emitNewBid } from "../utils/socket.js";

export const placeBid = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      bidAmount,
      deliveryAddress,
      paymentMethod = "Cash on Delivery",
    } = req.body;

    const product = await Product.findById(id).populate(
      "user",
      "name email role address"
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Cannot bid on inactive product",
      });
    }

    // Check if product is expired
    if (new Date(product.expiryDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Bidding has ended for this product",
      });
    }

    // Cannot bid on own post
    if (product.user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "Cannot bid on your own post",
      });
    }

    // Get bidder details for address
    const bidder = await User.findById(req.user.id);

    // 🎯 SMART BID VALIDATION BASED ON POST TYPE AND CURRENT BIDS
    const pendingBids = product.bids.filter((bid) => bid.status === "pending");

    if (product.postType === "sell") {
      // Buyer bidding on SELLER post - must provide higher bid than current highest or base price
      const currentHighestBid =
        pendingBids.length > 0
          ? Math.max(...pendingBids.map((b) => b.bidAmount))
          : product.pricePerKg;

      if (bidAmount <= currentHighestBid) {
        return res.status(400).json({
          success: false,
          message: `Bid must be higher than current highest bid: ₹${currentHighestBid}/kg`,
        });
      }

      // 🎯 FOR SELLER POSTS: Require delivery address from buyer
      if (
        !deliveryAddress ||
        !deliveryAddress.address ||
        !deliveryAddress.city ||
        !deliveryAddress.state ||
        !deliveryAddress.zipCode
      ) {
        return res.status(400).json({
          success: false,
          message: "Delivery address is required when bidding on seller posts",
        });
      }
    } else if (product.postType === "buy") {
      // Seller bidding on BUYER post - must provide lower bid than current lowest or base price
      const currentLowestBid =
        pendingBids.length > 0
          ? Math.min(...pendingBids.map((b) => b.bidAmount))
          : product.pricePerKg;

      if (bidAmount >= currentLowestBid) {
        return res.status(400).json({
          success: false,
          message: `Bid must be lower than current lowest bid: ₹${currentLowestBid}/kg`,
        });
      }
    }

    // Multiple bids allowed until time end, so we removed the existingBid check.

    // 🎯 SMART DELIVERY ADDRESS HANDLING
    let finalDeliveryAddress = {};

    if (product.postType === "sell") {
      // Seller post: Use buyer's provided delivery address
      finalDeliveryAddress = {
        address: deliveryAddress.address,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        zipCode: deliveryAddress.zipCode,
        country: deliveryAddress.country || "India",
      };
    } else {
      // Buyer post: Use buyer's profile address (from the post creator)
      finalDeliveryAddress = {
        address: product.user.address.street || product.user.address.address,
        city: product.user.address.city,
        state: product.user.address.state,
        zipCode: product.user.address.zipCode,
        country: product.user.address.country || "India",
      };
    }

    // Add bid with smart address handling
    product.bids.push({
      user: req.user.id,
      bidAmount: Number(bidAmount),
      bidAt: new Date(),
      status: "pending",
      deliveryAddress: finalDeliveryAddress,
      paymentMethod: paymentMethod,
    });

    await product.save();
    await product.populate("bids.user", "name email");

    // 🎯 CALCULATE TOP 5 BIDS
    const bidsCopy = [...product.bids];
    const topBids = bidsCopy
      .filter((bid) => bid.status === "pending")
      .sort((a, b) => {
        if (product.postType === "sell") {
          return b.bidAmount - a.bidAmount; // High to low for buyer bids
        } else {
          return a.bidAmount - b.bidAmount; // Low to high for seller bids
        }
      })
      .slice(0, 5);

    // 🎯 EMIT REAL-TIME SOCKET EVENT WITH TOP BIDS
    emitNewBid(product._id, {
      type: "NEW_BID",
      newBid: product.bids[product.bids.length - 1],
      topBids: topBids,
    });

    res.json({
      success: true,
      message: `Bid placed successfully${
        product.postType === "buy" ? " using buyer's delivery address" : ""
      }`,
      product,
      topBids,
      bidType: product.postType === "sell" ? "buyer_bid" : "seller_bid",
      deliveryAddressUsed: finalDeliveryAddress,
    });
  } catch (error) {
    console.error("Error placing bid:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const acceptBid = async (req, res) => {
  try {
    const { productId, bidId } = req.params;

    const product = await Product.findById(productId)
      .populate("user", "name email phone address")
      .populate("bids.user", "name email phone address");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if user owns the product post
    if (product.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to accept bids for this post",
      });
    }

    const bid = product.bids.id(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: "Bid not found",
      });
    }

    console.log("Accepting bid:", {
      postType: product.postType,
      postOwner: product.user.role,
      bidder: bid.user.role,
      bidAmount: bid.bidAmount,
    });

    // Update all bids status
    product.bids.forEach((b) => {
      if (b._id.toString() === bidId) {
        b.status = "accepted";
      } else {
        b.status = "rejected";
      }
    });

    // Set bid winner and mark product accordingly
    product.bidWinner = {
      user: bid.user._id,
      bidAmount: bid.bidAmount,
      acceptedAt: new Date(),
    };

    // Set appropriate status based on post type
    product.status = product.postType === "sell" ? "sold" : "purchased";
    product.soldAt = new Date();

    // 🎯 CALCULATE 2% COMPANY REVENUE
    const totalPrice = product.totalWeight * bid.bidAmount;
    const companyRevenue = totalPrice * 0.02; // 2% commission
    const sellerEarning = totalPrice - companyRevenue;

    // Update product with company revenue
    product.companyRevenue = companyRevenue;

    await product.save();

    // 🎯 EMIT REAL-TIME SOCKET EVENT FOR BID ACCEPTANCE
    emitNewBid(product._id, {
      type: "BID_ACCEPTED",
      winner: product.bidWinner,
      status: product.status,
    });

    // 🎯 DETERMINE SELLER AND BUYER BASED ON POST TYPE
    let seller, buyer;

    if (product.postType === "sell") {
      // Seller post: Post owner is seller, bidder is buyer
      seller = product.user._id;
      buyer = bid.user._id;
    } else {
      // Buyer post: Post owner is buyer, bidder is seller
      buyer = product.user._id;
      seller = bid.user._id;
    }

    // Generate order number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const todaysOrders = await Order.countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lte: new Date(date.setHours(23, 59, 59, 999)),
      },
    });

    const orderNumber = `ORD-${year}${month}${day}-${String(
      todaysOrders + 1
    ).padStart(4, "0")}`;

    // Create order with 2% commission
    const orderData = {
      orderNumber: orderNumber,
      product: productId,
      seller: seller,
      buyer: buyer,
      postType: product.postType,
      quantity: product.totalWeight,
      pricePerKg: bid.bidAmount,
      totalPrice: totalPrice,
      // 🎯 REVENUE FIELDS
      companyRevenue: parseFloat(companyRevenue.toFixed(2)),
      sellerEarning: parseFloat(sellerEarning.toFixed(2)),
      buyerPayment: totalPrice,
      commissionRate: 0.02, // 2%
      paymentMethod: bid.paymentMethod,
      sellerLocation: product.user.address,
      buyerLocation: bid.user.address,
      deliveryAddress: bid.deliveryAddress, // Smart address from bid
      expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: `Order created from ${product.postType} post: ${product.title}`,
    };

    const order = await Order.create(orderData);

    // Populate all data for response
    await product.populate("user", "name email phone");
    await product.populate("bids.user", "name email");
    await product.populate("bidWinner.user", "name email phone");

    // Populate order details
    await order.populate("product", "title images slug");
    await order.populate("seller", "name email phone");
    await order.populate("buyer", "name email phone");

    res.json({
      success: true,
      message: `Bid accepted successfully! ${
        product.postType === "sell" ? "Product sold" : "Purchase completed"
      }`,
      financials: {
        totalTransaction: totalPrice,
        companyRevenue: parseFloat(companyRevenue.toFixed(2)),
        sellerEarning: parseFloat(sellerEarning.toFixed(2)),
        commissionRate: "2%",
      },
      product,
      order,
    });
  } catch (error) {
    console.error("Error in acceptBid:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyBids = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 1. Find products where the user has placed at least one bid
    const query = { "bids.user": req.user.id };
    if (status && status !== "all") {
      query.status = status;
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean(); // Use lean for faster performance

    // 2. Format into a simplified single array
    const biddingHistory = products.map((product) => {
      // Find the user's specific bids on this product
      const userBids = product.bids.filter(
        (bid) => bid.user?.toString() === req.user.id
      );

      // Get the highest/latest bid amount from the user
      const myBidPrice =
        userBids.length > 0 ? Math.max(...userBids.map((b) => b.bidAmount)) : 0;

      // Check if user is the winner
      const isWinner = product.bidWinner?.user?.toString() === req.user.id;

      return {
        _id: product._id,
        name: product.title,
        image: product.images[0]?.url || null,
        basePrice: product.pricePerKg,
        myBidPrice: myBidPrice,
        status: product.status,
        isWinner: !!isWinner, // Returns true/false
      };
    });

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      biddingHistory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Error in getMyBids:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyWins = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Find products where the user is the confirmed winner
    const query = {
      "bidWinner.user": req.user.id,
      status: "sold",
    };

    const products = await Product.find(query)
      .populate("user", "name email phone") // The seller's details
      .sort({ updatedAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean();

    // Format into a simple array
    const wonProducts = products.map((product) => {
      return {
        _id: product._id,
        name: product.title,
        image: product.images[0]?.url || null,
        basePrice: product.pricePerKg,
        winningBidPrice: product.bidWinner?.bidAmount,
        totalWeight: product.totalWeight,
        seller: {
          name: product.user?.name,
          phone: product.user?.phone,
        },
        wonAt: product.bidWinner?.acceptedAt || product.updatedAt,
        status: product.status,
      };
    });

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      wonProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalWins: total,
      },
    });
  } catch (error) {
    console.error("Error in getMyWins:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
