"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplyCloudinaryService = void 0;
const cloudinary_1 = require("cloudinary");
const middlewares_1 = require("../middlewares");
const stream_1 = require("stream");
class ApplyCloudinaryService {
    constructor() {
        this.initialized = false;
        this.initialize();
    }
    initialize() {
        if (this.initialized)
            return;
        const cloudinaryUrl = process.env.CLOUDINARY_URL;
        if (!cloudinaryUrl) {
            middlewares_1.logger.warn('CLOUDINARY_URL not set. CV uploads will fail.');
            return;
        }
        try {
            cloudinary_1.v2.config(cloudinaryUrl);
            this.initialized = true;
            middlewares_1.logger.info('Cloudinary initialized for Apply system');
        }
        catch (error) {
            middlewares_1.logger.error('Failed to initialize Cloudinary:', error?.message || error);
            try {
                const urlMatch = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
                if (urlMatch && urlMatch.length >= 4) {
                    const [, apiKey, apiSecret, cloudName] = urlMatch;
                    cloudinary_1.v2.config({
                        cloud_name: cloudName,
                        api_key: apiKey,
                        api_secret: apiSecret,
                    });
                    this.initialized = true;
                    middlewares_1.logger.info('Cloudinary initialized using manual parsing');
                }
            }
            catch (fallbackError) {
                middlewares_1.logger.error('Failed to initialize Cloudinary (fallback):', fallbackError?.message || fallbackError);
            }
        }
    }
    async uploadCV(fileBuffer, fileName, userId) {
        if (!this.initialized) {
            throw new Error('Cloudinary not configured');
        }
        try {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                    resource_type: 'raw',
                    folder: `apply/cvs/${userId}`,
                    public_id: `cv_${Date.now()}`,
                    allowed_formats: ['pdf', 'doc', 'docx'],
                    max_file_size: 10 * 1024 * 1024,
                    tags: ['cv', 'resume', `user_${userId}`],
                }, (error, result) => {
                    if (error) {
                        middlewares_1.logger.error('Cloudinary upload error:', {
                            message: error.message,
                            http_code: error.http_code,
                            name: error.name,
                        });
                        let errorMessage = 'Upload failed';
                        if (error.message?.includes('Invalid api_key')) {
                            errorMessage = 'Cloudinary configuration error. Please contact support.';
                        }
                        else if (error.message?.includes('File size too large')) {
                            errorMessage = 'File size exceeds 10MB limit';
                        }
                        else if (error.message) {
                            errorMessage = `Upload failed: ${error.message}`;
                        }
                        reject(new Error(errorMessage));
                        return;
                    }
                    if (!result) {
                        reject(new Error('Upload failed: No result from Cloudinary'));
                        return;
                    }
                    resolve({
                        public_id: result.public_id,
                        secure_url: result.secure_url,
                        url: result.url,
                        format: result.format || 'pdf',
                        width: result.width,
                        height: result.height,
                        bytes: result.bytes,
                        created_at: result.created_at || new Date().toISOString(),
                    });
                });
                const bufferStream = new stream_1.Readable();
                bufferStream.push(fileBuffer);
                bufferStream.push(null);
                bufferStream.pipe(uploadStream);
            });
        }
        catch (error) {
            middlewares_1.logger.error('Error uploading CV to Cloudinary:', error);
            throw new Error(`CV upload failed: ${error.message}`);
        }
    }
    async deleteCV(publicId) {
        if (!this.initialized) {
            throw new Error('Cloudinary not configured');
        }
        try {
            await cloudinary_1.v2.uploader.destroy(publicId, {
                resource_type: 'raw',
            });
            middlewares_1.logger.info(`Deleted CV from Cloudinary: ${publicId}`);
        }
        catch (error) {
            middlewares_1.logger.error('Error deleting CV from Cloudinary:', error);
            throw new Error(`Failed to delete CV: ${error.message}`);
        }
    }
    async generateUploadSignature(userId) {
        if (!this.initialized) {
            throw new Error('Cloudinary not configured');
        }
        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = `apply/cvs/${userId}`;
        const signature = cloudinary_1.v2.utils.api_sign_request({
            timestamp,
            folder,
            allowed_formats: 'pdf,doc,docx',
            max_file_size: 10485760,
        }, process.env.CLOUDINARY_URL?.split(':')[2] || '');
        return {
            signature,
            timestamp,
            folder,
        };
    }
    isConfigured() {
        return this.initialized;
    }
}
exports.ApplyCloudinaryService = ApplyCloudinaryService;
//# sourceMappingURL=applyCloudinaryService.js.map