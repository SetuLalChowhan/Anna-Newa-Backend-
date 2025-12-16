import Category from "../models/category.js";

// Create category
export const createCategory = async (req, res) => {
    try {
        const { name } = req.body;

        // Simple validation
        if (!name) {
            return res.status(400).json({
                message: 'Category name is required'
            });
        }

        // Check if category exists
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({
                message: 'Category already exists'
            });
        }

        // Create category
        const category = await Category.create({ name });

        res.status(201).json({
            message: 'Category created successfully',
            category: category
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Get all categories
export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: 1 });

        res.status(200).json({
            count: categories.length,
            categories: categories
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Get single category by ID
export const getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({
                message: 'Category not found'
            });
        }

        res.status(200).json({
            category: category
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Update category
export const updateCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                message: 'Category name is required'
            });
        }

        // Check if name already exists (excluding current category)
        const existingCategory = await Category.findOne({ 
            name, 
            _id: { $ne: req.params.id } 
        });
        
        if (existingCategory) {
            return res.status(400).json({
                message: 'Category name already exists'
            });
        }

        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { name },
            { new: true }  // Return updated document
        );

        if (!category) {
            return res.status(404).json({
                message: 'Category not found'
            });
        }

        res.status(200).json({
            message: 'Category updated successfully',
            category: category
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};

// Delete category
export const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);

        if (!category) {
            return res.status(404).json({
                message: 'Category not found'
            });
        }

        res.status(200).json({
            message: 'Category deleted successfully',
            deletedCategory: category
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};