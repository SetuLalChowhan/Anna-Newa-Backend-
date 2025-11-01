import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    default: function() {
      return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
   postType: {
    type: String,
    enum: ['sell', 'buy'],
    required: true
  },
  seller: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  buyer: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  pricePerKg: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },

    // 🎯 COMPANY REVENUE FIELDS
  companyRevenue: {
    type: Number,
    required: true,
    default: 0
  },
  sellerEarning: {
    type: Number,
    required: true
  },
  buyerPayment: {
    type: Number,
    required: true
  },
  commissionRate: {
    type: Number,
    default: 0.02 // 2%
  },
  paymentMethod: {
    type: String,
    enum: ['Cash on Delivery', 'Bank Transfer', 'UPI', 'Card'],
    default: 'Cash on Delivery'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  deliveryStatus: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  orderStatus: {
    type: String,
    enum: ['Processing', 'Completed', 'Cancelled', 'Refunded'],
    default: 'Processing'
  },
  sellerLocation: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  buyerLocation: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  deliveryAddress: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  notes: String,
  expectedDelivery: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  },
  deliveredAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  trackingNumber: String,
  shippingProvider: String,
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: String,
  reviewedAt: Date
}, {
  timestamps: true
});

export default mongoose.model('Order', orderSchema);