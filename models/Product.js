import mongoose from "mongoose";
import slugify from "slugify";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
    },
    pricePerKg: {
      type: Number,
      required: [true, "Price per kg is required"],
      min: [0, "Price cannot be negative"],
    },
    totalWeight: {
      type: Number,
      required: [true, "Total weight is required"],
      min: [0, "Weight cannot be negative"],
    },
    images: [
      {
        public_id: String,
        url: String,
      },
    ],
    location: {
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      zipCode: {
        type: String,
        required: true,
      },
    },
    bids: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: "User",
          required: true,
        },
        bidAmount: {
          type: Number,
          required: true,
        },
        bidAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        deliveryAddress: {
          address: {
            type: String,
            required: true,
          },
          city: {
            type: String,
            required: true,
          },
          state: {
            type: String,
            required: true,
          },
          zipCode: {
            type: String,
            required: true,
          },
          country: {
            type: String,
            default: "India",
          },
        },
        paymentMethod: {
          type: String,
          enum: ["Cash on Delivery", "Bank Transfer", "UPI", "Card"],
          default: "Cash on Delivery",
        },
      },
    ],
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    userRole: {
      type: String,
      enum: ["seller", "buyer"],
      required: true,
    },
    postType: {
      type: String,
      enum: ["sell", "buy"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "sold", "expired", "cancelled", "purchased"],
      default: "active",
    },
    category: {
      type: mongoose.Schema.ObjectId,
      ref: "Category",
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    bidWinner: {
      user: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
      bidAmount: Number,
      acceptedAt: Date,
    },
    soldAt: {
      type: Date,
    },
    companyRevenue: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug before saving
productSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug =
      slugify(this.title, {
        lower: true,
        strict: true,
      }) +
      "-" +
      Math.random().toString(36).substring(2, 7);
  }
  next();
});

export default mongoose.model("Product", productSchema);
