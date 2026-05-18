import { Module } from '@nestjs/common';
import { SalesAdminModule } from './admin/admin.module';
import { SalesModule } from './salesperson/sales.module';

@Module({
  imports: [SalesAdminModule, SalesModule],
})
export class SalesAuthModule {}
