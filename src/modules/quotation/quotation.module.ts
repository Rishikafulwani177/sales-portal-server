import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { S3UploadService } from '../../common/s3-upload.service';
import {
  SalesDocument,
  SalesDocumentSchema,
} from '../salesAuth/models/sales-document.schema';
import { SalespersonGuard } from '../salesAuth/guards/salesperson.guard';
import { QuotationController } from './quotation.controller';
import { QuotationShareService } from './quotation-share.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: (cfg.get<string>('SALES_ACCESS_TOKEN_TTL') ?? '1d') as any,
        },
      }),
    }),
    MongooseModule.forFeature([
      { name: SalesDocument.name, schema: SalesDocumentSchema },
    ]),
  ],
  controllers: [QuotationController],
  providers: [QuotationShareService, S3UploadService, SalespersonGuard],
  exports: [QuotationShareService],
})
export class QuotationModule {}
