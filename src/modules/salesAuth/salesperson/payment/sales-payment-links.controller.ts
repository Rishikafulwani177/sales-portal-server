import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { CurrentSalesUser } from '../../decorators/current-sales-user.decorator';
import { SalespersonGuard } from '../../guards/salesperson.guard';
import { SalesDocumentPaymentsService } from './sales-document-payments.service';

class CreatePaymentLinkDto {
  @IsString()
  @IsNotEmpty()
  quotationId!: string;

  @IsString()
  @IsNotEmpty()
  farmerName!: string;

  @IsString()
  @IsNotEmpty()
  farmerPhone!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  @IsOptional()
  description?: string;
}

@Controller('payments')
export class SalesPaymentLinksController {
  constructor(private readonly paymentsService: SalesDocumentPaymentsService) {}

  // Protected: only salesperson tokens can create payment links
  @UseGuards(SalespersonGuard)
  @Post('payment-link')
  async createPaymentLink(
    @Body() body: CreatePaymentLinkDto,
    @CurrentSalesUser() salesperson: { login_id: string },
  ) {
    const { quotationId, farmerName, farmerPhone, amount, description } = body as any;

    return this.paymentsService.createPaymentLinkForQuotation({
      quotationId,
      farmerName,
      farmerPhone,
      amount,
      description,
      salespersonId: salesperson.login_id,
    });
  }
}
