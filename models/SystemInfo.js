import mongoose from "mongoose";

const systemInfoSchema = new mongoose.Schema(
  {
    logo: {
      public_id: String,
      url: String,
    },
    description: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    supportHours: {
      type: String,
      required: true,
    },
    socialLinks: {
      instagram: String,
      facebook: String,
      linkedin: String,
      youtube: String,
    },
    copyrightMessage: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("SystemInfo", systemInfoSchema);
