import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: "Bangladesh",
      },
    },
    role: {
      type: String,
      enum: ["seller", "buyer"],
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    profilePicture: {
      public_id: String,
      url: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    resetKey: String, // For reset password verification
    resetKeyExpire: Date,
  },
  {
    timestamps: true,
  }
);

// Encrypt password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
userSchema.methods.getJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' } // Fixed: use direct value
  );
};

// Generate verification token
userSchema.methods.getVerificationToken = function () {
  const verificationToken = Math.floor(
    100000 + Math.random() * 900000
  ).toString();
  this.verificationToken = verificationToken;
  this.verificationTokenExpire = Date.now() + 10 * 60 * 1000;
  return verificationToken;
};

// Generate reset token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
  this.resetPasswordToken = resetToken;
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

export default mongoose.model("User", userSchema);
