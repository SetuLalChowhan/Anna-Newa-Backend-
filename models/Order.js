import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      default: function () {
        return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      },
    },
    product: {
      type: mongoose.Schema.ObjectId,
      ref: "Product",
      required: true,
    },
    postType: {
      type: String,
      enum: ["sell", "buy"],
      required: true,
    },
    seller: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    buyer: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    pricePerKg: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // 🎯 COMPANY REVENUE FIELDS
    companyRevenue: {
      type: Number,
      required: true,
      default: 0,
    },
    sellerEarning: {
      type: Number,
      required: true,
    },
    buyerPayment: {
      type: Number,
      required: true,
    },
    commissionRate: {
      type: Number,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash on Delivery", "Bank Transfer", "UPI", "Card"],
      default: "Cash on Delivery",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },
    deliveryStatus: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: ["Processing", "Completed", "Cancelled", "Refunded"],
      default: "Processing",
    },
    sellerLocation: {
      address: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: "India",
      },
    },
    buyerLocation: {
      address: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: "India",
      },
    },
    deliveryAddress: {
      address: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: "India",
      },
    },
    notes: String,
    expectedDelivery: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    deliveredAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    trackingNumber: String,
    shippingProvider: String,
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: String,
    reviewedAt: Date,
  },
  {
    timestamps: true,
  }
);

// 🎯 SYNC STATUS & CREDIT WALLET
orderSchema.pre("save", async function (next) {
  // 1. If delivery status is 'Delivered', set order status to 'Completed'
  if (
    this.isModified("deliveryStatus") &&
    this.deliveryStatus === "Delivered"
  ) {
    this.orderStatus = "Completed";
    this.deliveredAt = new Date();
    this.paymentStatus = "Paid"; // Assuming delivery implies payment for COD or it's already paid
  }

  // 2. If order status becomes 'Completed', credit seller's wallet
  if (this.isModified("orderStatus") && this.orderStatus === "Completed") {
    try {
      const User = mongoose.model("User");
      const seller = await User.findById(this.seller);

      if (seller) {
        seller.wallet.balance += this.sellerEarning;
        seller.wallet.transactions.push({
          amount: this.sellerEarning,
          type: "credit",
          description: `Earnings from Order #${this.orderNumber}`,
        });
        await seller.save();
      }
    } catch (error) {
      console.error("Wallet credit error:", error);
      // We don't necessarily want to block the order update if wallet fails,
      // but in production you'd want a transaction or retry logic.
    }
  }
  next();
});

export default mongoose.model("Order", orderSchema);
