import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { S3UploadService } from '../../common/s3-upload.service';
import { SalesDocument } from '../salesAuth/models/sales-document.schema';
import {
  PublicQuotationResponseDto,
  QuotationShareResponseDto,
} from './dto/quotation-share-response.dto';

const SIGNED_URL_EXPIRY_SECONDS = 15 * 60;
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

@Injectable()
export class QuotationShareService {
  constructor(
    @InjectModel(SalesDocument.name)
    private readonly salesDocumentModel: Model<SalesDocument>,
    private readonly s3UploadService: S3UploadService,
    private readonly configService: ConfigService,
  ) {}

  async uploadPdf(params: {
    salespersonId: string;
    quotationId: string;
    file: { buffer?: Buffer; mimetype?: string; size?: number } | undefined;
  }): Promise<QuotationShareResponseDto> {
    const quotation = await this.findOwnedQuotation(
      params.salespersonId,
      params.quotationId,
      { allowInactive: true },
    );

    this.validatePdfFile(params.file);

    const publicId = quotation.quotationPublicId || this.generatePublicId();
    const { s3Key } = await this.s3UploadService.uploadQuotationPdf(
      String(quotation._id),
      params.file!.buffer!,
    );

    const updated = await this.salesDocumentModel.findOneAndUpdate(
      { _id: quotation._id },
      {
        $set: {
          quotationPublicId: publicId,
          s3Key,
          pdfUploadedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Quotation not found');
    }

    return this.buildShareResponse(updated);
  }

  async getDownloadUrl(params: {
    salespersonId: string;
    quotationId: string;
  }): Promise<QuotationShareResponseDto> {
    const quotation = await this.findOwnedQuotation(
      params.salespersonId,
      params.quotationId,
      { allowInactive: true },
    );

    if (!quotation.s3Key) {
      throw new BadRequestException('Quotation PDF has not been uploaded');
    }

    return this.buildShareResponse(quotation);
  }

  async getPublicQuotation(
    publicId: string,
  ): Promise<PublicQuotationResponseDto> {
    const quotation = await this.salesDocumentModel.findOne({
      quotationPublicId: publicId,
      type: 'quotation',
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    this.ensureActiveQuotation(quotation);

    const share = await this.buildShareResponse(quotation);

    return {
      ...share,
      quotation: this.toQuotationPayload(quotation),
      customer: {
        name: quotation.customerName,
        phone: quotation.customerPhone,
      },
    };
  }

  async deleteQuotation(params: {
    salespersonId: string;
    quotationId: string;
  }): Promise<{ message: string; documentNumber: string }> {
    const quotation = await this.findOwnedQuotation(
      params.salespersonId,
      params.quotationId,
    );

    if (quotation.s3Key) {
      await this.s3UploadService.deleteQuotationPdf(quotation.s3Key);
    }

    await this.salesDocumentModel.deleteOne({ _id: (quotation as any)._id });

    return {
      message: 'Quotation deleted successfully',
      documentNumber: quotation.documentNumber,
    };
  }

  private async findOwnedQuotation(
    salespersonId: string,
    quotationId: string,
    options: { allowInactive?: boolean } = {},
  ) {
    const query = {
      salesperson_id: salespersonId,
      type: 'quotation',
      $or: [
        { documentNumber: quotationId },
        ...(this.isMongoObjectId(quotationId) ? [{ _id: quotationId }] : []),
      ],
    };

    const quotation = await this.salesDocumentModel.findOne(query);

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (options.allowInactive) {
      if (quotation.type !== 'quotation') {
        throw new BadRequestException('Only quotations can be deleted');
      }
    } else {
      this.ensureActiveQuotation(quotation);
    }
    return quotation;
  }

  private validatePdfFile(
    file: { buffer?: Buffer; mimetype?: string; size?: number } | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('PDF file is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF uploads are allowed');
    }

    if ((file.size || file.buffer.length) > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('PDF size must be 15MB or less');
    }

    if (!file.buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      throw new BadRequestException('Uploaded file is not a valid PDF');
    }
  }

  private ensureActiveQuotation(quotation: SalesDocument) {
    if (quotation.type !== 'quotation') {
      throw new BadRequestException('Only quotations can be shared');
    }

    if (quotation.paymentStatus === 'failed') {
      throw new BadRequestException('Quotation is not active');
    }
  }

  private async buildShareResponse(
    quotation: SalesDocument,
  ): Promise<QuotationShareResponseDto> {
    const publicId = quotation.quotationPublicId || this.generatePublicId();

    if (!quotation.quotationPublicId) {
      quotation.quotationPublicId = publicId;
      await (quotation as any).save();
    }

    const pdfDownloadUrl = quotation.s3Key
      ? await this.getSignedUrlOrThrow(quotation.s3Key)
      : null;
    const paymentLink = quotation.onlinePaymentUrl || null;
    const quotationLink = `${this.getFrontendBaseUrl()}/quotation/public/${publicId}`;
    const customerName = quotation.customerName || 'Customer';

    return {
      quotationLink,
      pdfDownloadUrl,
      paymentLink,
      customerName,
      message: this.buildShareMessage({
        customerName,
        quotationLink,
        paymentLink,
        pdfDownloadUrl,
      }),
    };
  }

  private async getSignedUrlOrThrow(s3Key: string) {
    try {
      return await this.s3UploadService.getQuotationSignedUrl(
        s3Key,
        SIGNED_URL_EXPIRY_SECONDS,
      );
    } catch (error: any) {
      throw new InternalServerErrorException(
        error?.message || 'Unable to generate PDF download URL',
      );
    }
  }

  private toQuotationPayload(quotation: SalesDocument) {
    const data = quotation.data || {};

    return {
      ...data,
      items: quotation.items || data.items || [],
      id: (quotation as any)._id,
      type: quotation.type,
      documentNumber: quotation.documentNumber,
      quoteNumber: data.quoteNumber || quotation.documentNumber,
      customerName: quotation.customerName,
      customerPhone: quotation.customerPhone,
      subtotal: quotation.subtotal,
      gst: quotation.gst,
      grandTotal: quotation.grandTotal,
      paymentStatus: quotation.paymentStatus || 'unpaid',
      onlinePaymentUrl: quotation.onlinePaymentUrl,
      onlinePaymentExpiresAt: quotation.onlinePaymentExpiresAt,
      pdfUploadedAt: quotation.pdfUploadedAt,
      createdAt: (quotation as any).createdAt,
      updatedAt: (quotation as any).updatedAt,
    };
  }

  private buildShareMessage(params: {
    customerName: string;
    quotationLink: string;
    paymentLink: string | null;
    pdfDownloadUrl?: string | null;
  }) {
    const viewLink = params.pdfDownloadUrl || params.quotationLink;

    return [
      `Hello ${params.customerName},`,
      '',
      'Your quotation is ready.',
      '',
      'View Quotation:',
      viewLink,
      '',
      'Complete Payment:',
      params.paymentLink || 'Payment link will be available on the quotation page.',
    ].join('\n');
  }

  private getFrontendBaseUrl() {
    return (
      this.configService.get<string>('SALES_PORTAL_PUBLIC_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'https://sales-portal-next.vercel.app'
    ).replace(/\/$/, '');
  }

  private generatePublicId() {
    return crypto.randomBytes(16).toString('hex');
  }

  private isMongoObjectId(value: string) {
    return /^[a-f\d]{24}$/i.test(value);
  }
}
