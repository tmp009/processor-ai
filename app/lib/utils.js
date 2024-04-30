const fs = require('fs/promises')

async function deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      } else {
        return false;
      }
    }
}

  module.exports = { deleteFile }
