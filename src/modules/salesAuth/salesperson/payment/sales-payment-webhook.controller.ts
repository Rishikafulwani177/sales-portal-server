import { Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SalesDocumentPaymentsService } from './sales-document-payments.service';

@Controller()
export class SalesPaymentWebhookController {
  constructor(private readonly paymentsService: SalesDocumentPaymentsService) {}

  @Post('payments/webhook')
  async handleWebhook(@Req() req: Request) {
    return this.paymentsService.handleZohoWebhook(req);
  }
}
