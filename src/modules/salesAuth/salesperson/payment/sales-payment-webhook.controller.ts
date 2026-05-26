import { Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SalesDocumentPaymentsService } from './sales-document-payments.service';

@Controller('payments')
export class SalesPaymentWebhookController {
  constructor(private readonly paymentsService: SalesDocumentPaymentsService) {}

  @Post('webhook-sales-doc')
  async handleWebhook(@Req() req: Request) {
    return this.paymentsService.handleZohoWebhook(req);
  }
}
