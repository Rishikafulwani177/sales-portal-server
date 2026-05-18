import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { SalesAdmin, SalesAdminSchema } from '../models/sales-admin.schema';
import {
  Salesperson,
  SalespersonSchema,
} from '../models/salesperson.schema';
import { SalesController } from './sales.controller';
import { SalesAuthService } from '../salesAuth.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: SalesAdmin.name, schema: SalesAdminSchema },
      { name: Salesperson.name, schema: SalespersonSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: (cfg.get<string>('SALES_ACCESS_TOKEN_TTL') ?? '1d') as any,
        },
      }),
    }),
  ],
  controllers: [SalesController],
  providers: [SalesAuthService],
})
export class SalesModule {}
