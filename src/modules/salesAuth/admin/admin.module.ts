import { Module } from '@nestjs/common';
import { SalesAdminController } from './admin.controller';

@Module({
  controllers: [SalesAdminController],
})
export class SalesAdminModule {}
