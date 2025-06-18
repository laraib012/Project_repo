const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

// Azure Blob Storage configuration
const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerName = process.env.BLOB_CONTAINER_NAME || 'product-images';

// Initialize container if it doesn't exist
async function initializeContainer() {
    try {
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists({
            access: 'blob' // Public read access for images
        });
        console.log('✅ Blob container initialized:', containerName);
    } catch (error) {
        console.error('❌ Error initializing blob container:', error);
    }
}

// Upload file to blob storage
async function uploadToBlob(fileName, fileBuffer, contentType) {
    try {
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlockBlobClient(fileName);
        
        const uploadOptions = {
            blobHTTPHeaders: {
                blobContentType: contentType
            }
        };
        
        await blobClient.upload(fileBuffer, fileBuffer.length, uploadOptions);
        
        // Return the blob URL
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const blobUrl = `https://ecommercestorage01.blob.core.windows.net/product-images/${fileName}`;
console.log("🔗 Returning blob URL:", blobUrl);
return blobUrl;

    } catch (error) {
        console.error('Error uploading to blob storage:', error);
        throw error;
    }
}

// Initialize container on module load
initializeContainer();

module.exports = {
    uploadToBlob
};