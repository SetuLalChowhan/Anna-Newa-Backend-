import User from '../models/User.js';
import { sendEmail, emailTemplates } from '../utils/sendEmail.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';

// Set JWT token in cookie
const sendToken = (user, res, message) => {
  const token = user.getJwtToken();

  const options = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res.status(200).cookie('token', token, options).json({
    success: true,
    message,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
    },
  });
};

export const register = async (req, res) => {
  try {
    const { name, email, phone, address, role, password, confirm_password } = req.body;

    if (password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    const user = await User.create({
      name,
      email,
      phone,
      address,
      role,
      password,
    });

    const verificationToken = user.getVerificationToken();
    await user.save();

    await sendEmail({
      email: user.email,
      subject: 'Email Verification - Annanewa Farming Media',
      html: emailTemplates.verification(user.name, verificationToken),
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Check email for verification code.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({
      email,
      verificationToken: code,
      verificationTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired code',
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save();

    sendToken(user, res, 'Email verified successfully');
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email first',
      });
    }

    sendToken(user, res, 'Login successful');
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const logout = async (req, res) => {
  res.cookie('token', null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  }).json({
    success: true,
    message: 'Logged out successfully',
  });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save();

    // Send email with reset code
    await sendEmail({
      email: user.email,
      subject: 'Password Reset - Annanewa Farming Media',
      html: emailTemplates.resetPassword(user.name, resetToken),
    });

    res.json({
      success: true,
      message: 'Reset code sent to email',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordToken: code,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code',
      });
    }

    // Generate a reset key for the final reset step
    const resetKey = Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15);
    
    user.resetKey = resetKey;
    user.resetKeyExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    res.json({
      success: true,
      message: 'Reset code verified successfully',
      resetKey: resetKey, // Send this key for the final reset step
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const resendOTP = async (req, res) => {
  try {
    const { email, type } = req.body; // type: 'verification' or 'reset'

    if (!email || !type) {
      return res.status(400).json({
        success: false,
        message: 'Email and type are required',
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    let otp;
    let subject;
    let template;

    if (type === 'verification') {
      // Resend verification OTP
      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified',
        });
      }
      
      otp = user.getVerificationToken();
      subject = 'Email Verification - Annanewa Farming Media';
      template = emailTemplates.verification(user.name, otp);
      
    } else if (type === 'reset') {
      // Resend password reset OTP
      otp = user.getResetPasswordToken();
      subject = 'Password Reset - Annanewa Farming Media';
      template = emailTemplates.resetPassword(user.name, otp);
      
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Use "verification" or "reset"',
      });
    }

    await user.save();

    // Send email
    await sendEmail({
      email: user.email,
      subject: subject,
      html: template,
    });

    res.json({
      success: true,
      message: `OTP sent successfully to ${email}`,
      type: type,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, resetKey, password, confirm_password } = req.body;

    if (password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    const user = await User.findOne({
      email,
      resetKey: resetKey,
      resetKeyExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset key',
      });
    }

    // Reset password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.resetKey = undefined;
    user.resetKeyExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, address },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image',
      });
    }

    const user = await User.findById(req.user.id);
    
    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer);
    
    // Delete old image
    if (user.profilePicture?.public_id) {
      await deleteFromCloudinary(user.profilePicture.public_id);
    }
    
    // Update user
    user.profilePicture = {
      public_id: result.public_id,
      url: result.secure_url,
    };
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture updated',
      profilePicture: user.profilePicture,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified',
      });
    }

    const verificationToken = user.getVerificationToken();
    await user.save();

    await sendEmail({
      email: user.email,
      subject: 'Email Verification - Annanewa Farming Media',
      html: emailTemplates.verification(user.name, verificationToken),
    });

    res.json({
      success: true,
      message: 'Verification code sent',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};