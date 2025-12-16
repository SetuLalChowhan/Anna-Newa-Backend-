import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    }
}, {
    timestamps: true  // Adds createdAt and updatedAt fields
});

export default mongoose.model('Category', categorySchema);