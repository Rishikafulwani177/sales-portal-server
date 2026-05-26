import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_QUOTATION_PDF_SIZE_MB = 15;
const MAX_QUOTATION_PDF_SIZE_BYTES = MAX_QUOTATION_PDF_SIZE_MB * 1024 * 1024;
const DEFAULT_QUOTATION_SIGNED_URL_EXPIRY_SECONDS = 15 * 60;

@Injectable()
export class S3UploadService {
  private readonly logger = new Logger(S3UploadService.name);
  private s3: S3Client;
  private bucket: string;
  private region: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow('AWS_S3_BUCKET_NAME');
    this.region = this.configService.getOrThrow('AWS_REGION');

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.getOrThrow('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  // ✅ Check if file exists in S3
  private async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  // ✅ Normalize extension safely
  private getSafeExtension(contentType?: string): string {
    if (!contentType) return 'jpg';

    const ext = contentType.split('/')[1]?.split(';')[0]?.toLowerCase();

    const allowed = ['jpg', 'jpeg', 'png', 'webp'];
    if (allowed.includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }

    return 'jpg';
  }

  async uploadImageFromUrl(
    imageUrl: string,
    itemId: string,
    zohoToken?: string,
    existingHash?: string,
  ): Promise<{
    s3Url: string;
    s3Key: string;
    imageHash: string;
    skipped: boolean;
  }> {
    this.logger.log(`⬇️ Downloading: ${imageUrl}`);

    // 🔽 Download image
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: zohoToken
        ? { Authorization: `Zoho-oauthtoken ${zohoToken}` }
        : {},
      maxContentLength: MAX_IMAGE_SIZE_BYTES,
      maxBodyLength: MAX_IMAGE_SIZE_BYTES,
    });

    const buffer = Buffer.from(response.data);

    // 🚫 Size validation
    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(
        `Image too large: ${(buffer.length / 1024 / 1024).toFixed(
          2,
        )}MB exceeds ${MAX_IMAGE_SIZE_MB}MB`,
      );
    }

    // 🔐 Hash
    const imageHash = crypto.createHash('md5').update(buffer).digest('hex');

    const contentType = response.headers['content-type'];
    const ext = this.getSafeExtension(contentType);

    const s3Key = `products/${itemId}.${ext}`;
    const s3Url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${s3Key}`;

    // 🔍 Check existence in S3
    const exists = await this.fileExists(s3Key);

    // ✅ Safe skip logic (FIXED BUG)
    if (existingHash && existingHash === imageHash && exists) {
      this.logger.log(
        `⏭️ Image unchanged AND exists → skipping upload (${itemId})`,
      );
      return { s3Url, s3Key, imageHash, skipped: true };
    }

    // 🚀 Upload to S3
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType || 'image/jpeg',
      }),
    );

    this.logger.log(`✅ Uploaded to S3: ${s3Url}`);

    return { s3Url, s3Key, imageHash, skipped: false };
  }

  // 🗑️ Delete image
  async deleteImage(s3Key: string): Promise<void> {
    if (!s3Key) return;

    try {
      const exists = await this.fileExists(s3Key);

      if (!exists) {
        this.logger.warn(`⚠️ File not found in S3 (skip delete): ${s3Key}`);
        return;
      }

      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
        }),
      );

      this.logger.log(`🗑️ Deleted from S3: ${s3Key}`);
    } catch (err: any) {
      this.logger.error(
        `❌ Failed to delete from S3: ${s3Key} — ${err.message}`,
      );
    }
  }

  async uploadQuotationPdf(
    quotationId: string,
    buffer: Buffer,
  ): Promise<{ s3Key: string }> {
    if (!quotationId?.trim()) {
      throw new Error('Quotation id is required');
    }

    if (!buffer?.length) {
      throw new Error('Quotation PDF is required');
    }

    if (buffer.length > MAX_QUOTATION_PDF_SIZE_BYTES) {
      throw new Error(
        `Quotation PDF too large: ${(buffer.length / 1024 / 1024).toFixed(
          2,
        )}MB exceeds ${MAX_QUOTATION_PDF_SIZE_MB}MB`,
      );
    }

    const s3Key = `quotations/${quotationId}.pdf`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: 'application/pdf',
          ContentDisposition: `attachment; filename="${quotationId}.pdf"`,
        }),
      );

      this.logger.log(`Uploaded private quotation PDF to S3: ${s3Key}`);
      return { s3Key };
    } catch (err: any) {
      this.logger.error(
        `Failed to upload quotation PDF to S3: ${s3Key} - ${err.message}`,
      );
      throw err;
    }
  }

  async getQuotationSignedUrl(
    s3Key: string,
    expiresInSeconds = DEFAULT_QUOTATION_SIGNED_URL_EXPIRY_SECONDS,
  ): Promise<string> {
    if (!s3Key?.startsWith('quotations/')) {
      throw new Error('Invalid quotation PDF key');
    }

    const expiresIn = Number.isFinite(expiresInSeconds)
      ? Math.max(60, Math.min(expiresInSeconds, 60 * 60))
      : DEFAULT_QUOTATION_SIGNED_URL_EXPIRY_SECONDS;

    try {
      return getSignedUrl(
        this.s3,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
        }),
        { expiresIn },
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to generate quotation signed URL: ${s3Key} - ${err.message}`,
      );
      throw err;
    }
  }

  async deleteQuotationPdf(s3Key: string): Promise<void> {
    if (!s3Key) return;
    if (!s3Key.startsWith('quotations/')) {
      throw new Error('Invalid quotation PDF key');
    }

    try {
      const exists = await this.fileExists(s3Key);

      if (!exists) {
        this.logger.warn(`Quotation PDF not found in S3: ${s3Key}`);
        return;
      }

      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
        }),
      );

      this.logger.log(`Deleted quotation PDF from S3: ${s3Key}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to delete quotation PDF from S3: ${s3Key} - ${err.message}`,
      );
      throw err;
    }
  }
}
