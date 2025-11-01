import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

// @desc    Get all users with pagination and search
// @route   GET /api/admin/users
// @access  Private (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const { 
      search, 
      role, 
      isVerified, 
      page = 1, 
      limit = 10 
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build search query
    const query = {};

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by role
    if (role && role !== 'all') {
      query.role = role;
    }

    // Filter by verification status
    if (isVerified && isVerified !== 'all') {
      query.isVerified = isVerified === 'true';
    }

    const users = await User.find(query)
      .select('-password') // Exclude password
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await User.countDocuments(query);

    // Get user statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      users,
      statistics: {
        totalUsers: total,
        sellers: userStats.find(stat => stat._id === 'seller')?.count || 0,
        buyers: userStats.find(stat => stat._id === 'buyer')?.count || 0,
        admins: userStats.find(stat => stat._id === 'admin')?.count || 0
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalUsers: total
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:userId
// @access  Private (Admin only)
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's products count
    const productsCount = await Product.countDocuments({ user: user._id });

    // Get user's orders count
    const ordersAsSeller = await Order.countDocuments({ seller: user._id });
    const ordersAsBuyer = await Order.countDocuments({ buyer: user._id });

    // Get total sales/revenue for seller
    const sellerStats = await Order.aggregate([
      { $match: { seller: user._id, orderStatus: 'Completed' } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalPrice' },
          totalEarnings: { $sum: '$sellerEarning' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        statistics: {
          productsCount,
          ordersAsSeller,
          ordersAsBuyer,
          totalSales: sellerStats[0]?.totalSales || 0,
          totalEarnings: sellerStats[0]?.totalEarnings || 0,
          completedOrders: sellerStats[0]?.totalOrders || 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update user role or status
// @route   PUT /api/admin/users/:userId
// @access  Private (Admin only)
export const updateUser = async (req, res) => {
  try {
    const { role, isActive, isVerified } = req.body;

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build update data
    const updateData = {};
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (typeof isVerified === 'boolean') updateData.isVerified = isVerified;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:userId
// @access  Private (Admin only)
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is super admin (prevent deletion)
    if (user.role === 'super-admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete super admin'
      });
    }

    // Delete user's products
    await Product.deleteMany({ user: user._id });

    // Update orders to mark as cancelled
    await Order.updateMany(
      { 
        $or: [{ seller: user._id }, { buyer: user._id }],
        orderStatus: { $in: ['Processing', 'Pending'] }
      },
      {
        orderStatus: 'Cancelled',
        deliveryStatus: 'Cancelled',
        cancellationReason: 'User account deleted by admin'
      }
    );

    // Delete user
    await User.findByIdAndDelete(req.params.userId);

    res.json({
      success: true,
      message: 'User and associated data deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all products with admin filters
// @route   GET /api/admin/products
// @access  Private (Admin only)
export const getAllProducts = async (req, res) => {
  try {
    const { 
      search, 
      status, 
      category, 
      postType,
      userId,
      page = 1, 
      limit = 10 
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // Search by title
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Filter by post type
    if (postType && postType !== 'all') {
      query.postType = postType;
    }

    // Filter by user
    if (userId) {
      query.user = userId;
    }

    const products = await Product.find(query)
      .populate('user', 'name email role')
      .populate('bidWinner.user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Product.countDocuments(query);

    // Product statistics
    const productStats = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      products,
      statistics: {
        totalProducts: total,
        active: productStats.find(stat => stat._id === 'active')?.count || 0,
        sold: productStats.find(stat => stat._id === 'sold')?.count || 0,
        purchased: productStats.find(stat => stat._id === 'purchased')?.count || 0,
        expired: productStats.find(stat => stat._id === 'expired')?.count || 0
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total
      }
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/admin/products/:productId
// @access  Private (Admin only)
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete from Cloudinary if images exist
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        await deleteFromCloudinary(image.public_id);
      }
    }

    await Product.findByIdAndDelete(req.params.productId);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get platform dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
export const getDashboardStats = async (req, res) => {
  try {
    // User statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Product statistics
    const productStats = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // 🎯 FIXED: Order statistics - Separate revenue and transactions
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$companyRevenue' }, // 2% commission
          totalTransactions: { $sum: '$totalPrice' } // Total sales amount
        }
      }
    ]);

    // 🎯 FIXED: Overall platform financials
    const platformFinancials = await Order.aggregate([
      { $match: { orderStatus: 'Completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$companyRevenue' }, // Your 2% earnings
          totalTransactions: { $sum: '$totalPrice' }, // Total money moved
          totalOrders: { $sum: 1 },
          totalSellerPayout: { $sum: '$sellerEarning' } // 98% to sellers
        }
      }
    ]);

    const financials = platformFinancials[0] || {
      totalRevenue: 0,
      totalTransactions: 0,
      totalOrders: 0,
      totalSellerPayout: 0
    };

    // Recent activities
    const recentOrders = await Order.find()
      .populate('product', 'title')
      .populate('seller', 'name')
      .populate('buyer', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderNumber totalPrice companyRevenue orderStatus createdAt');

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStats = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: today, $lt: tomorrow },
          orderStatus: 'Completed'
        } 
      },
      {
        $group: {
          _id: null,
          todayOrders: { $sum: 1 },
          todayRevenue: { $sum: '$companyRevenue' }, // 2% commission
          todayTransactions: { $sum: '$totalPrice' } // Total sales today
        }
      }
    ]);

    const todayData = todayStats[0] || {
      todayOrders: 0,
      todayRevenue: 0,
      todayTransactions: 0
    };

    res.json({
      success: true,
      dashboard: {
        // 📊 SUMMARY CARDS
        summary: {
          totalUsers: userStats.reduce((sum, stat) => sum + stat.count, 0),
          totalProducts: productStats.reduce((sum, stat) => sum + stat.count, 0),
          totalOrders: orderStats.reduce((sum, stat) => sum + stat.count, 0),
          
          // 🎯 FIXED: Clear separation
          totalRevenue: parseFloat(financials.totalRevenue.toFixed(2)), // Your 2% earnings
          totalTransactions: parseFloat(financials.totalTransactions.toFixed(2)), // Total sales
          totalSellerPayout: parseFloat(financials.totalSellerPayout.toFixed(2)), // 98% to sellers
          
          todayOrders: todayData.todayOrders,
          todayRevenue: parseFloat(todayData.todayRevenue.toFixed(2)),
          todayTransactions: parseFloat(todayData.todayTransactions.toFixed(2))
        },

        // 👥 USER BREAKDOWN
        users: {
          sellers: userStats.find(stat => stat._id === 'seller')?.count || 0,
          buyers: userStats.find(stat => stat._id === 'buyer')?.count || 0,
          admins: userStats.find(stat => stat._id === 'admin')?.count || 0
        },

        // 📦 PRODUCT BREAKDOWN
        products: {
          active: productStats.find(stat => stat._id === 'active')?.count || 0,
          sold: productStats.find(stat => stat._id === 'sold')?.count || 0,
          purchased: productStats.find(stat => stat._id === 'purchased')?.count || 0
        },

        // 📈 ORDER BREAKDOWN
        orders: {
          completed: orderStats.find(stat => stat._id === 'Completed')?.count || 0,
          processing: orderStats.find(stat => stat._id === 'Processing')?.count || 0,
          cancelled: orderStats.find(stat => stat._id === 'Cancelled')?.count || 0
        },

        // 💰 FINANCIAL BREAKDOWN
        financials: {
          commissionRate: "2%",
          revenue: parseFloat(financials.totalRevenue.toFixed(2)), // Your earnings
          transactions: parseFloat(financials.totalTransactions.toFixed(2)), // Platform volume
          sellerPayout: parseFloat(financials.totalSellerPayout.toFixed(2)), // To sellers
          averageOrderValue: financials.totalOrders > 0 ? 
            parseFloat((financials.totalTransactions / financials.totalOrders).toFixed(2)) : 0
        },

        // 🔄 RECENT ACTIVITIES
        recentActivities: {
          orders: recentOrders,
          users: recentUsers
        }
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update product status
// @route   PUT /api/admin/products/:productId/status
// @access  Private (Admin only)
export const updateProductStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const product = await Product.findById(req.params.productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.productId,
      { status },
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    res.json({
      success: true,
      message: 'Product status updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};