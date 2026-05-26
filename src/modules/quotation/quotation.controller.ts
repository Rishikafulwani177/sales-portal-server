import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentSalesUser } from '../salesAuth/decorators/current-sales-user.decorator';
import { SalespersonGuard } from '../salesAuth/guards/salesperson.guard';
import { QuotationShareService } from './quotation-share.service';

@Controller('quotation')
export class QuotationController {
  constructor(private readonly quotationShareService: QuotationShareService) {}

  @UseGuards(SalespersonGuard)
  @Post(':id/upload-pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadQuotationPdf(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @CurrentSalesUser() salesperson: { login_id: string },
  ) {
    return this.quotationShareService.uploadPdf({
      salespersonId: salesperson.login_id,
      quotationId: id,
      file,
    });
  }

  @UseGuards(SalespersonGuard)
  @Get(':id/download')
  async getQuotationDownload(
    @Param('id') id: string,
    @CurrentSalesUser() salesperson: { login_id: string },
  ) {
    return this.quotationShareService.getDownloadUrl({
      salespersonId: salesperson.login_id,
      quotationId: id,
    });
  }

  @Get('public/:publicId')
  async getPublicQuotation(@Param('publicId') publicId: string) {
    return this.quotationShareService.getPublicQuotation(publicId);
  }

  @UseGuards(SalespersonGuard)
  @Delete(':id')
  async deleteQuotation(
    @Param('id') id: string,
    @CurrentSalesUser() salesperson: { login_id: string },
  ) {
    return this.quotationShareService.deleteQuotation({
      salespersonId: salesperson.login_id,
      quotationId: id,
    });
  }
}
