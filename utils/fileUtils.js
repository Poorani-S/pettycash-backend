const fs = require("fs");
const path = require("path");

/**
 * Delete a file from the filesystem
 * @param {string} filePath - Path to the file to delete
 * @returns {Promise<boolean>}
 */
const deleteFile = async (filePath) => {
  try {
    if (!filePath) return true;

    const fullPath = path.join(__dirname, "..", filePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`File deleted: ${filePath}`);
      return true;
    }
    return true;
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    return false;
  }
};

/**
 * Get file size in bytes
 * @param {string} filePath - Path to the file
 * @returns {number}
 */
const getFileSize = (filePath) => {
  try {
    const fullPath = path.join(__dirname, "..", filePath);
    const stats = fs.statSync(fullPath);
    return stats.size;
  } catch (error) {
    console.error(`Error getting file size for ${filePath}:`, error);
    return 0;
  }
};

/**
 * Check if file exists
 * @param {string} filePath - Path to the file
 * @returns {boolean}
 */
const fileExists = (filePath) => {
  try {
    const fullPath = path.join(__dirname, "..", filePath);
    return fs.existsSync(fullPath);
  } catch (error) {
    return false;
  }
};

/**
 * Format file path for URL
 * @param {string} filePath - Path to the file
 * @returns {string}
 */
const formatFileUrl = (filePath) => {
  if (!filePath) return "";
  return filePath.replace(/\\/g, "/");
};

/**
 * Get file extension
 * @param {string} filename - Name of the file
 * @returns {string}
 */
const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

/**
 * Validate file type
 * @param {string} filename - Name of the file
 * @param {string[]} allowedTypes - Array of allowed extensions
 * @returns {boolean}
 */
const isValidFileType = (filename, allowedTypes) => {
  const ext = getFileExtension(filename).substring(1);
  return allowedTypes.includes(ext);
};

module.exports = {
  deleteFile,
  getFileSize,
  fileExists,
  formatFileUrl,
  getFileExtension,
  isValidFileType,
};
