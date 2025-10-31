import Product from '../models/Product.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';

// @desc    Create product (Both seller & buyer can create)
// @route   POST /api/products
// @access  Private (both roles)
export const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      pricePerKg,
      totalWeight,
      location,
      category,
      expiryDate
    } = req.body;

    // Upload images
    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        images.push({
          public_id: result.public_id,
          url: result.secure_url
        });
      }
    }

    const product = await Product.create({
      title,
      description,
      pricePerKg,
      totalWeight,
      location: JSON.parse(location),
      category,
      expiryDate,
      images,
      user: req.user.id
    });

    await product.populate('user', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get MY products (personal products)
// @route   GET /api/products/my-products
// @access  Private (both seller & buyer)
export const getMyProducts = async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 10 } = req.query;
    
    const query = { user: req.user.id };
    
    if (search) query.title = { $regex: search, $options: 'i' };
    if (category && category !== 'all') query.category = category;
    if (status && status !== 'all') query.status = status;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(query)
      .populate('bids.user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get products for BUYER (see products created by SELLERS)
// @route   GET /api/products/for-buyer
// @access  Buyer only
export const getProductsForBuyer = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, state, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Step 1: Find all SELLER users
    const sellerUsers = await User.find({ role: 'seller' }).select('_id');
    const sellerIds = sellerUsers.map(user => user._id);

    // Step 2: Build query for products created by sellers
    const query = { 
      user: { $in: sellerIds },
      status: 'active'
    };

    if (search) query.title = { $regex: search, $options: 'i' };
    if (category && category !== 'all') query.category = category;
    if (minPrice || maxPrice) {
      query.pricePerKg = {};
      if (minPrice) query.pricePerKg.$gte = parseFloat(minPrice);
      if (maxPrice) query.pricePerKg.$lte = parseFloat(maxPrice);
    }
    if (state && state !== 'all') {
      query['location.state'] = { $regex: state, $options: 'i' };
    }

    const products = await Product.find(query)
      .populate('user', 'name email phone address role')
      .populate('bids.user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);
      

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      message: 'Products from sellers',
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get products for SELLER (see products created by BUYERS)
// @route   GET /api/products/for-seller
// @access  Seller only
export const getProductsForSeller = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, state, page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Step 1: Find all BUYER users
    const buyerUsers = await User.find({ role: 'buyer' }).select('_id');
    const buyerIds = buyerUsers.map(user => user._id);

    // Step 2: Build query for products created by buyers
    const query = { 
      user: { $in: buyerIds }, // Only products from buyers
      status: 'active'
    };

    if (search) query.title = { $regex: search, $options: 'i' };
    if (category && category !== 'all') query.category = category;
    if (minPrice || maxPrice) {
      query.pricePerKg = {};
      if (minPrice) query.pricePerKg.$gte = parseFloat(minPrice);
      if (maxPrice) query.pricePerKg.$lte = parseFloat(maxPrice);
    }
    if (state && state !== 'all') {
      query['location.state'] = { $regex: state, $options: 'i' };
    }

    const products = await Product.find(query)
      .populate('user', 'name email phone address role')
      .populate('bids.user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      message: 'Products from buyers',
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single product by ID or slug
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
  try {
    let product;
    
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findById(req.params.id)
        .populate('user', 'name email phone address role')
        .populate('bids.user', 'name email');
    } else {
      product = await Product.findOne({ slug: req.params.id })
        .populate('user', 'name email phone address role')
        .populate('bids.user', 'name email');
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      product
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update MY product
// @route   PUT /api/products/my-products/:id
// @access  Private (owner only)
export const updateMyProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product'
      });
    }

    const updateData = { ...req.body };
    
    if (req.body.location) {
      updateData.location = JSON.parse(req.body.location);
    }

    if (req.files && req.files.length > 0) {
      const newImages = [];
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        newImages.push({
          public_id: result.public_id,
          url: result.secure_url
        });
      }
      updateData.images = [...product.images, ...newImages];
    }

    product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('user', 'name email role');

    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete MY product
// @route   DELETE /api/products/my-products/:id
// @access  Private (owner only)
export const deleteMyProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product'
      });
    }

    for (const image of product.images) {
      await deleteFromCloudinary(image.public_id);
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// @desc    Get all products (Admin)
// @route   GET /api/products/admin/all
// @access  Admin only
export const getAdminProducts = async (req, res) => {
  try {
    const { search, status, userId, page = 1, limit = 10 } = req.query;
    
    const query = {};
    
    // Search by title or ID
    if (search) {
      if (mongoose.Types.ObjectId.isValid(search)) {
        query._id = search;
      } else {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } }
        ];
      }
    }
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Filter by user
    if (userId) {
      query.user = userId;
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(query)
      .populate('user', 'name email role')
      .populate('bids.user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



export const placeBid = async (req, res) => {
  try {
    const { bidAmount } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot bid on inactive product'
      });
    }

    if (product.user.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot bid on your own product'
      });
    }

    // Check if user already placed a bid
    const existingBid = product.bids.find(bid => 
      bid.user.toString() === req.user.id && bid.status === 'pending'
    );

    if (existingBid) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending bid on this product'
      });
    }

    // Add bid
    product.bids.push({
      user: req.user.id,
      bidAmount: Number(bidAmount),
      bidAt: new Date(),
      status: 'pending'
    });

    await product.save();
    await product.populate('bids.user', 'name email');

    res.json({
      success: true,
      message: 'Bid placed successfully',
      product
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Accept a bid (Product Owner)
// @route   PUT /api/products/:productId/accept-bid/:bidId
// @access  Product Owner only
export const acceptBid = async (req, res) => {
  try {
    const { productId, bidId } = req.params;
    
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user owns the product
    if (product.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept bids for this product'
      });
    }

    // Find the bid
    const bid = product.bids.id(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    // Update all bids status
    product.bids.forEach(b => {
      if (b._id.toString() === bidId) {
        b.status = 'accepted';
      } else {
        b.status = 'rejected';
      }
    });

    // Set bid winner and mark product as sold
    product.bidWinner = {
      user: bid.user,
      bidAmount: bid.bidAmount,
      acceptedAt: new Date()
    };
    product.status = 'sold';
    product.soldAt = new Date();

    await product.save();
    
    // Populate all data for response
    await product.populate('user', 'name email phone');
    await product.populate('bids.user', 'name email');
    await product.populate('bidWinner.user', 'name email phone');

    res.json({
      success: true,
      message: 'Bid accepted successfully. Product marked as sold.',
      product
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get my bidding history
// @route   GET /api/products/my-bids
// @access  Private (both roles)
// @desc    Get my bidding history
// @route   GET /api/products/my-bids/history
// @access  Private (both roles)
export const getMyBids = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Find products where user has placed bids
    const query = { 
      'bids.user': req.user.id 
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    const products = await Product.find(query)
      .populate('user', 'name email phone address')
      .populate('bids.user', 'name email')
      .populate('bidWinner.user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    // Filter and format bids for the current user - SAFELY
    const biddingHistory = products.map(product => {
      // Safely filter user's bids
      const userBids = product.bids.filter(bid => {
        // Check if bid.user exists and has _id
        return bid.user && bid.user._id && bid.user._id.toString() === req.user.id;
      });
      
      if (userBids.length === 0) return null; // Skip if no valid bids found

      const latestBid = userBids[userBids.length - 1]; // Get latest bid
      
      // Safely check if user is winner
      const isWinner = product.bidWinner && 
                      product.bidWinner.user &&
                      product.bidWinner.user._id &&
                      product.bidWinner.user._id.toString() === req.user.id;

      return {
        product: {
          _id: product._id,
          title: product.title,
          slug: product.slug,
          images: product.images,
          pricePerKg: product.pricePerKg,
          totalWeight: product.totalWeight,
          status: product.status,
          user: product.user
        },
        myBid: latestBid,
        allMyBids: userBids,
        isWinner: isWinner,
        bidWinner: product.bidWinner,
        totalBidsOnProduct: product.bids.length
      };
    }).filter(item => item !== null); // Remove null entries

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      biddingHistory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total
      }
    });

  } catch (error) {
    console.error('Error in getMyBids:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get products where I won bids
// @route   GET /api/products/my-wins
// @access  Private (both roles)
export const getMyWins = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Find products where user is the bid winner
    const query = { 
      'bidWinner.user': req.user.id,
      status: 'sold'
    };

    console.log(query)

    const products = await Product.find(query)
      .populate('user', 'name email phone address')
      .populate('bidWinner.user', 'name email phone')
      .sort({ soldAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      wonProducts: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalWins: total
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get product with bids details
// @route   GET /api/products/:id/with-bids
// @access  Private (product owner or bidders)
export const getProductWithBids = async (req, res) => {
  try {
    let product;
    
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findById(req.params.id)
        .populate('user', 'name email phone address')
        .populate('bids.user', 'name email phone')
        .populate('bidWinner.user', 'name email phone');
    } else {
      product = await Product.findOne({ slug: req.params.id })
        .populate('user', 'name email phone address')
        .populate('bids.user', 'name email phone')
        .populate('bidWinner.user', 'name email phone');
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user can view bids (owner or someone who bid)
    const canViewBids = product.user._id.toString() === req.user.id || 
                       product.bids.some(bid => bid.user._id.toString() === req.user.id);

    if (!canViewBids) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view bids for this product'
      });
    }

    // Get user's bid if any
    const myBid = product.bids.find(bid => 
      bid.user._id.toString() === req.user.id
    );

    res.json({
      success: true,
      product,
      myBid: myBid || null,
      canAcceptBids: product.user._id.toString() === req.user.id
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};