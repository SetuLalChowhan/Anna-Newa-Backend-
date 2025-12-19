import mongoose from "mongoose";
import slugify from "slugify";

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Article title is required"],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, "Article description is required"],
    },

    cover_image: {
      public_id: String,
      url: String,
    },
    images: [
      {
        public_id: String,
        url: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

articleSchema.pre("save", function (next) {
  if (this.isModified("title")) {
    this.slug =
      slugify(this.title, {
        lower: true,
        strict: true,
      }) +
      "-" +
      Math.random().toString(36).substring(2, 7);
  }
  next();
});
export default mongoose.model("Article", articleSchema);
