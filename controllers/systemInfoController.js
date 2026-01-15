import SystemInfo from "../models/SystemInfo.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";

// @desc    Get system info
// @route   GET /api/system-info
// @access  Public
export const getSystemInfo = async (req, res) => {
  try {
    const systemInfo = await SystemInfo.findOne();
    if (!systemInfo) {
      return res.status(404).json({
        success: false,
        message: "System information not found",
      });
    }
    res.status(200).json({
      success: true,
      data: systemInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create system info (Admin only)
// @route   POST /api/system-info
// @access  Private (Admin)
export const createSystemInfo = async (req, res) => {
  try {
    const existingInfo = await SystemInfo.findOne();
    if (existingInfo) {
      return res.status(400).json({
        success: false,
        message: "System info already exists. Use update instead.",
      });
    }

    const {
      description,
      phone,
      email,
      supportHours,
      instagram,
      facebook,
      linkedin,
      youtube,
      copyrightMessage,
    } = req.body;

    let logo = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      logo = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    const systemInfo = await SystemInfo.create({
      logo,
      description,
      phone,
      email,
      supportHours,
      socialLinks: {
        instagram,
        facebook,
        linkedin,
        youtube,
      },
      copyrightMessage,
    });

    res.status(201).json({
      success: true,
      message: "System info created successfully",
      data: systemInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update system info (Admin only)
// @route   PUT /api/system-info
// @access  Private (Admin)
export const updateSystemInfo = async (req, res) => {
  try {
    let systemInfo = await SystemInfo.findOne();
    if (!systemInfo) {
      return res.status(404).json({
        success: false,
        message: "System information not found",
      });
    }

    const {
      description,
      phone,
      email,
      supportHours,
      instagram,
      facebook,
      linkedin,
      youtube,
      copyrightMessage,
    } = req.body;

    if (description) systemInfo.description = description;
    if (phone) systemInfo.phone = phone;
    if (email) systemInfo.email = email;
    if (supportHours) systemInfo.supportHours = supportHours;
    if (copyrightMessage) systemInfo.copyrightMessage = copyrightMessage;

    if (instagram !== undefined) systemInfo.socialLinks.instagram = instagram;
    if (facebook !== undefined) systemInfo.socialLinks.facebook = facebook;
    if (linkedin !== undefined) systemInfo.socialLinks.linkedin = linkedin;
    if (youtube !== undefined) systemInfo.socialLinks.youtube = youtube;

    if (req.file) {
      // Delete old logo
      if (systemInfo.logo && systemInfo.logo.public_id) {
        await deleteFromCloudinary(systemInfo.logo.public_id);
      }
      const result = await uploadToCloudinary(req.file.buffer);
      systemInfo.logo = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    await systemInfo.save();

    res.status(200).json({
      success: true,
      message: "System info updated successfully",
      data: systemInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
