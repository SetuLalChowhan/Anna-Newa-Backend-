import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";

export const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      pricePerKg,
      totalWeight,
      location,
      category,
      expiryDate,
      postType, // 'sell' or 'buy'
    } = req.body;

    // Validate post type based on user role
    if (!postType || !["sell", "buy"].includes(postType)) {
      return res.status(400).json({
        success: false,
        message: 'Post type must be "sell" or "buy"',
      });
    }

    // Upload images
    const images = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        images.push({
          public_id: result.public_id,
          url: result.secure_url,
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
      postType,
      userRole: req.user.role, // Store who created this post
      user: req.user.id,
      images,
    });

    await product.populate("user", "name email role");

    res.status(201).json({
      success: true,
      message: `Product ${
        postType === "sell" ? "sale" : "purchase"
      } post created successfully`,
      product,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyProducts = async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 10 } = req.query;

    const query = { user: req.user.id };

    if (search) query.title = { $regex: search, $options: "i" };
    if (category && category !== "all") query.category = category;
    if (status && status !== "all") query.status = status;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(query)
      .populate("bids.user", "name email")
      .populate("category", "name" )
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
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getProductsForBuyer = async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      state,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Step 1: Find all SELLER users
    const sellerUsers = await User.find({ role: "seller" }).select("_id");
    const sellerIds = sellerUsers.map((user) => user._id);

    // Step 2: Build query for products created by sellers
    const query = {
      user: { $in: sellerIds },
      status: "active",
    };

    if (search) query.title = { $regex: search, $options: "i" };
    if (category && category !== "all") query.category = category;
    if (minPrice || maxPrice) {
      query.pricePerKg = {};
      if (minPrice) query.pricePerKg.$gte = parseFloat(minPrice);
      if (maxPrice) query.pricePerKg.$lte = parseFloat(maxPrice);
    }
    if (state && state !== "all") {
      query["location.state"] = { $regex: state, $options: "i" };
    }

    const products = await Product.find(query)
      .populate("user", "name email phone address role")
      .populate("bids.user", "name email")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      message: "Products from sellers",
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const {
      search,
      status,
      category,
      postType,
      userId,
      page = 1,
      limit = 10,
      sort = "latest", // <-- new sort parameter
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // Search by title
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // Filter by status
    if (status && status !== "all") {
      query.status = status;
    }

    // Filter by category
    if (category && category !== "all") {
     if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = new mongoose.Types.ObjectId(category);
      }
    }

    // Filter by post type
    if (postType && postType !== "all") {
      query.postType = postType;
    }

    // Determine sort
    let sortOption = { createdAt: -1 }; // default: latest
    if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    } else if (sort === "highestPrice") {
      sortOption = { pricePerKg: -1 };
    } else if (sort === "lowestPrice") {
      sortOption = { pricePerKg: 1 };
    }

    const products = await Product.find(query)
      .select("title description pricePerKg totalWeight images category")
      .populate("category", "name" )
      .sort(sortOption)
      .limit(limitNum)
      .skip(skip);

    const total = await Product.countDocuments(query);

  

    res.json({
      success: true,
      totalProducts: total,
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getProductsForSeller = async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      state,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Step 1: Find all BUYER users
    const buyerUsers = await User.find({ role: "buyer" }).select("_id");
    const buyerIds = buyerUsers.map((user) => user._id);

    // Step 2: Build query for products created by buyers
    const query = {
      user: { $in: buyerIds }, // Only products from buyers
      status: "active",
    };

    if (search) query.title = { $regex: search, $options: "i" };
    if (category && category !== "all") query.category = category;
    if (minPrice || maxPrice) {
      query.pricePerKg = {};
      if (minPrice) query.pricePerKg.$gte = parseFloat(minPrice);
      if (maxPrice) query.pricePerKg.$lte = parseFloat(maxPrice);
    }
    if (state && state !== "all") {
      query["location.state"] = { $regex: state, $options: "i" };
    }

    const products = await Product.find(query)
      .populate("user", "name email phone address role")
      .populate("bids.user", "name email")
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      message: "Products from buyers",
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getProduct = async (req, res) => {
  try {
    let product;

    product = await Product.findOne({ slug: req.params.slug })
      .populate("user", "name email phone address role")
      .populate("category", "name" )
      .populate("bids.user", "name email");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateMyProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this product",
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
          url: result.secure_url,
        });
      }
      updateData.images = [...product.images, ...newImages];
    }

    product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate("user", "name email role");

    res.json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteMyProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this product",
      });
    }

    for (const image of product.images) {
      await deleteFromCloudinary(image.public_id);
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

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
          { title: { $regex: search, $options: "i" } },
          { slug: { $regex: search, $options: "i" } },
        ];
      }
    }

    // Filter by status
    if (status && status !== "all") {
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
      .populate("user", "name email role")
      .populate("bids.user", "name email")
      .populate("category", "name" )
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
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
