import cloudinary from '../config/cloudinary.js';

export const uploadToCloudinary = async (buffer) => {
  try {
    const base64Image = buffer.toString('base64');
    const dataURI = `data:image/jpeg;base64,${base64Image}`;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'annanewa/profiles',
      transformation: [
        { width: 500, height: 500, crop: 'limit' },
        { quality: 'auto' },
        { format: 'jpg' }
      ]
    });
    
    return result;
  } catch (error) {
    throw new Error('Failed to upload image');
  }
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.log('Delete failed for:', publicId);
  }
};