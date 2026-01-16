import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    commissionRate: {
      type: Number,
      required: true,
      default: 2, // 2%
    },
    // We can add more settings here in the future
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ commissionRate: 2 });
  }
  return settings;
};

export default mongoose.model("Settings", settingsSchema);
