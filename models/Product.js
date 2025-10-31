import mongoose from 'mongoose';
import slugify from 'slugify';

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Product title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  pricePerKg: {
    type: Number,
    required: [true, 'Price per kg is required'],
    min: [0, 'Price cannot be negative']
  },
  totalWeight: {
    type: Number,
    required: [true, 'Total weight is required'],
    min: [0, 'Weight cannot be negative']
  },
  images: [{
    public_id: String,
    url: String
  }],
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    }
  },
  bids: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    bidAmount: {
      type: Number,
      required: true
    },
    bidAt: {
      type: Date,
      default: Date.now
    }
  }],
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'expired'],
    default: 'active'
  },
  category: {
    type: String,
    enum: ['vegetables', 'fruits', 'grains', 'dairy', 'poultry', 'other'],
    default: 'other'
  },
  expiryDate: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Generate slug before saving
productSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true
    }) + '-' + Math.random().toString(36).substring(2, 7);
  }
  next();
});

// Index for search
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ user: 1 });
productSchema.index({ status: 1 });

export default mongoose.model('Product', productSchema);