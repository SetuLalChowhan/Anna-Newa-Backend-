import Product from '../models/Product.js';
import User from '../models/User.js';
import mongoose, { isValidObjectId } from 'mongoose';
import Order from "../models/Order.js"


export const placeBid = async (req, res) => {
  try {
    const { id } = req.params;
    const { bidAmount, deliveryAddress, paymentMethod = 'Cash on Delivery' } = req.body;

    const product = await Product.findById(id)
      .populate('user', 'name email role address');

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

    // Cannot bid on own post
    if (product.user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot bid on your own post'
      });
    }

    // Get bidder details for address
    const bidder = await User.findById(req.user.id);

    // 🎯 SMART BID VALIDATION BASED ON POST TYPE
    if (product.postType === 'sell') {
      // Buyer bidding on SELLER post - must provide higher bid
      if (bidAmount <= product.pricePerKg) {
        return res.status(400).json({
          success: false,
          message: `Bid must be higher than current price: ₹${product.pricePerKg}/kg`
        });
      }

      // 🎯 FOR SELLER POSTS: Require delivery address from buyer
      if (!deliveryAddress || !deliveryAddress.address || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.zipCode) {
        return res.status(400).json({
          success: false,
          message: 'Delivery address is required when bidding on seller posts'
        });
      }

    } else if (product.postType === 'buy') {
      // Seller bidding on BUYER post - must provide lower bid
      if (bidAmount >= product.pricePerKg) {
        return res.status(400).json({
          success: false,
          message: `Bid must be lower than buyer's asking price: ₹${product.pricePerKg}/kg`
        });
      }

      // 🎯 FOR BUYER POSTS: Automatically use buyer's address from their profile
      // No delivery address required in request body
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

    // 🎯 SMART DELIVERY ADDRESS HANDLING
    let finalDeliveryAddress = {};

    if (product.postType === 'sell') {
      // Seller post: Use buyer's provided delivery address
      finalDeliveryAddress = {
        address: deliveryAddress.address,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        zipCode: deliveryAddress.zipCode,
        country: deliveryAddress.country || 'India'
      };
    } else {
      // Buyer post: Use buyer's profile address (from the post creator)
      finalDeliveryAddress = {
        address: product.user.address.street || product.user.address.address,
        city: product.user.address.city,
        state: product.user.address.state,
        zipCode: product.user.address.zipCode,
        country: product.user.address.country || 'India'
      };
    }

    // Add bid with smart address handling
    product.bids.push({
      user: req.user.id,
      bidAmount: Number(bidAmount),
      bidAt: new Date(),
      status: 'pending',
      deliveryAddress: finalDeliveryAddress,
      paymentMethod: paymentMethod
    });

    await product.save();
    await product.populate('bids.user', 'name email');

    res.json({
      success: true,
      message: `Bid placed successfully${product.postType === 'buy' ? ' using buyer\'s delivery address' : ''}`,
      product,
      bidType: product.postType === 'sell' ? 'buyer_bid' : 'seller_bid',
      deliveryAddressUsed: finalDeliveryAddress
    });

  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


export const acceptBid = async (req, res) => {
  try {
    const { productId, bidId } = req.params;

    const product = await Product.findById(productId)
      .populate('user', 'name email phone address')
      .populate('bids.user', 'name email phone address');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user owns the product post
    if (product.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to accept bids for this post'
      });
    }

    const bid = product.bids.id(bidId);
    if (!bid) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found'
      });
    }

    console.log('Accepting bid:', {
      postType: product.postType,
      postOwner: product.user.role,
      bidder: bid.user.role,
      bidAmount: bid.bidAmount
    });

    // Update all bids status
    product.bids.forEach(b => {
      if (b._id.toString() === bidId) {
        b.status = 'accepted';
      } else {
        b.status = 'rejected';
      }
    });

    // Set bid winner and mark product accordingly
    product.bidWinner = {
      user: bid.user._id,
      bidAmount: bid.bidAmount,
      acceptedAt: new Date()
    };
    
    // Set appropriate status based on post type
    product.status = product.postType === 'sell' ? 'sold' : 'purchased';
    product.soldAt = new Date();

    // 🎯 CALCULATE 2% COMPANY REVENUE
    const totalPrice = product.totalWeight * bid.bidAmount;
    const companyRevenue = totalPrice * 0.02; // 2% commission
    const sellerEarning = totalPrice - companyRevenue;

    // Update product with company revenue
    product.companyRevenue = companyRevenue;

    await product.save();

    // 🎯 DETERMINE SELLER AND BUYER BASED ON POST TYPE
    let seller, buyer;

    if (product.postType === 'sell') {
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
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const todaysOrders = await Order.countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lte: new Date(date.setHours(23, 59, 59, 999))
      }
    });
    
    const orderNumber = `ORD-${year}${month}${day}-${String(todaysOrders + 1).padStart(4, '0')}`;

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
      notes: `Order created from ${product.postType} post: ${product.title}`
    };

    const order = await Order.create(orderData);

    // Populate all data for response
    await product.populate('user', 'name email phone');
    await product.populate('bids.user', 'name email');
    await product.populate('bidWinner.user', 'name email phone');
    
    // Populate order details
    await order.populate('product', 'title images slug');
    await order.populate('seller', 'name email phone');
    await order.populate('buyer', 'name email phone');

    res.json({
      success: true,
      message: `Bid accepted successfully! ${product.postType === 'sell' ? 'Product sold' : 'Purchase completed'}`,
      financials: {
        totalTransaction: totalPrice,
        companyRevenue: parseFloat(companyRevenue.toFixed(2)),
        sellerEarning: parseFloat(sellerEarning.toFixed(2)),
        commissionRate: '2%'
      },
      product,
      order
    });

  } catch (error) {
    console.error('Error in acceptBid:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


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