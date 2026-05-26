export class QuotationShareResponseDto {
  quotationLink!: string;
  pdfDownloadUrl!: string | null;
  paymentLink!: string | null;
  customerName!: string;
  message!: string;
}

export class PublicQuotationResponseDto extends QuotationShareResponseDto {
  quotation!: Record<string, any>;
  customer!: {
    name: string;
    phone?: string;
  };
}
