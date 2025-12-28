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
export declare class ApplyCloudinaryService {
    private initialized;
    constructor();
    private initialize;
    uploadCV(fileBuffer: Buffer, fileName: string, userId: string): Promise<CloudinaryUploadResult>;
    deleteCV(publicId: string): Promise<void>;
    generateUploadSignature(userId: string): Promise<{
        signature: string;
        timestamp: number;
        folder: string;
    }>;
    isConfigured(): boolean;
}
//# sourceMappingURL=applyCloudinaryService.d.ts.map