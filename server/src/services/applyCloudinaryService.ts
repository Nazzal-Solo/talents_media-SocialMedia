import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../middlewares';
import { Readable } from 'stream';

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  created_at: string;
}

export class ApplyCloudinaryService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;

    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (!cloudinaryUrl) {
      logger.warn('CLOUDINARY_URL not set. CV uploads will fail.');
      return;
    }

    try {
      // Cloudinary v2 can use the URL directly
      cloudinary.config(cloudinaryUrl);
      this.initialized = true;
      logger.info('Cloudinary initialized for Apply system');
    } catch (error: any) {
      logger.error('Failed to initialize Cloudinary:', error?.message || error);
      // Try manual parsing as fallback
      try {
        const urlMatch = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
        if (urlMatch && urlMatch.length >= 4) {
          const [, apiKey, apiSecret, cloudName] = urlMatch;
          cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
          });
          this.initialized = true;
          logger.info('Cloudinary initialized using manual parsing');
        }
      } catch (fallbackError: any) {
        logger.error('Failed to initialize Cloudinary (fallback):', fallbackError?.message || fallbackError);
      }
    }
  }

  /**
   * Upload CV/Resume file to Cloudinary
   */
  async uploadCV(
    fileBuffer: Buffer,
    fileName: string,
    userId: string
  ): Promise<CloudinaryUploadResult> {
    if (!this.initialized) {
      throw new Error('Cloudinary not configured');
    }

    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw', // PDF/DOCX are raw files
            folder: `apply/cvs/${userId}`,
            public_id: `cv_${Date.now()}`,
            allowed_formats: ['pdf', 'doc', 'docx'],
            max_file_size: 10 * 1024 * 1024, // 10MB max
            tags: ['cv', 'resume', `user_${userId}`],
          },
          (error, result) => {
            if (error) {
              logger.error('Cloudinary upload error:', {
                message: error.message,
                http_code: (error as any).http_code,
                name: error.name,
              });
              
              // Provide user-friendly error message
              let errorMessage = 'Upload failed';
              if (error.message?.includes('Invalid api_key')) {
                errorMessage = 'Cloudinary configuration error. Please contact support.';
              } else if (error.message?.includes('File size too large')) {
                errorMessage = 'File size exceeds 10MB limit';
              } else if (error.message) {
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
          }
        );

        // Convert buffer to stream
        const bufferStream = new Readable();
        bufferStream.push(fileBuffer);
        bufferStream.push(null);
        bufferStream.pipe(uploadStream);
      });
    } catch (error: any) {
      logger.error('Error uploading CV to Cloudinary:', error);
      throw new Error(`CV upload failed: ${error.message}`);
    }
  }

  /**
   * Delete CV from Cloudinary
   */
  async deleteCV(publicId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Cloudinary not configured');
    }

    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
      });
      logger.info(`Deleted CV from Cloudinary: ${publicId}`);
    } catch (error: any) {
      logger.error('Error deleting CV from Cloudinary:', error);
      throw new Error(`Failed to delete CV: ${error.message}`);
    }
  }

  /**
   * Generate signed upload URL for direct client upload (alternative approach)
   */
  async generateUploadSignature(userId: string): Promise<{
    signature: string;
    timestamp: number;
    folder: string;
  }> {
    if (!this.initialized) {
      throw new Error('Cloudinary not configured');
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = `apply/cvs/${userId}`;

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
        allowed_formats: 'pdf,doc,docx',
        max_file_size: 10485760, // 10MB
      },
      process.env.CLOUDINARY_URL?.split(':')[2] || ''
    );

    return {
      signature,
      timestamp,
      folder,
    };
  }

  /**
   * Check if Cloudinary is configured
   */
  isConfigured(): boolean {
    return this.initialized;
  }
}

