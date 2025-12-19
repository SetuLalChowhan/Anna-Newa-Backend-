import Article from "../models/Article.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";

export const createArticle = async (req, res) => {
  try {
    const { title, description } = req.body;

    // ✅ Validate input
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    // ✅ Handle cover image
    let coverImage = null;
    const coverFile = req.files?.cover_image?.[0];

    if (coverFile) {
      const result = await uploadToCloudinary(coverFile.buffer);
      coverImage = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    // ✅ Handle multiple images
    const images = [];
    const imageFiles = req.files?.images || [];

    for (const file of imageFiles) {
      const result = await uploadToCloudinary(file.buffer);
      images.push({
        public_id: result.public_id,
        url: result.secure_url,
      });
    }

    // ✅ Create article
    const article = await Article.create({
      title,
      description,
      cover_image: coverImage,
      images,
    });

    res.status(201).json({
      success: true,
      message: "Article created successfully",
      data: article,
    });
  } catch (error) {
    console.error("Error creating article:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const getAllArticles = async (req, res) => {
  try {
    const { search, page = 1, limit = 10, sort = "latest" } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // Search by title
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    // Determine sort
    let sortOption = { createdAt: -1 }; // default: latest
    if (sort === "oldest") {
      sortOption = { createdAt: 1 };
    }

    const articles = await Article.find(query)
      .sort(sortOption)
      .limit(limitNum)
      .skip(skip);

    const total = await Article.countDocuments(query);

    res.json({
      success: true,
      totalArticles: total,
      articles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalProducts: total,
      },
    });
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getArticle = async (req,res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    res.json({
      success: true,
      article,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateArticle = async (req, res) => {
  try {
    const { title, description } = req.body;
    const { id } = req.params;

    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // ✅ Update text fields
    if (title) article.title = title;
    if (description) article.description = description;

    // ✅ Update cover image
    const coverFile = req.files?.cover_image?.[0];
    if (coverFile) {
      // delete old cover image
      if (article.cover_image?.public_id) {
        await deleteFromCloudinary(article.cover_image.public_id);
      }

      const result = await uploadToCloudinary(coverFile.buffer);
      article.cover_image = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    // ✅ Update gallery images
    const imageFiles = req.files?.images;
    if (imageFiles && imageFiles.length > 0) {
      // delete old images
      for (const img of article.images) {
        await deleteFromCloudinary(img.public_id);
      }

      const newImages = [];
      for (const file of imageFiles) {
        const result = await uploadToCloudinary(file.buffer);
        newImages.push({
          public_id: result.public_id,
          url: result.secure_url,
        });
      }

      article.images = newImages;
    }

    await article.save();

    res.json({
      success: true,
      message: "Article updated successfully",
      article,
    });
  } catch (error) {
    console.error("Error updating article:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;

    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    // ✅ Delete cover image
    if (article.cover_image?.public_id) {
      await deleteFromCloudinary(article.cover_image.public_id);
    }

    // ✅ Delete gallery images
    for (const img of article.images) {
      await deleteFromCloudinary(img.public_id);
    }

    await article.deleteOne();

    res.json({
      success: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting article:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

