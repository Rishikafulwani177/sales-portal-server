import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { CreateSalespersonDto } from '../dto/create-salesperson.dto';
import { SalesAdminLoginDto } from '../dto/sales-admin-login.dto';
import { CurrentSalesUser } from '../decorators/current-sales-user.decorator';
import { SalesAdminGuard } from '../guards/sales-admin.guard';
import { SalesAuthService } from '../salesAuth.service';

@Controller('sales-auth/admin')
export class SalesAdminController {
  constructor(private salesAuthService: SalesAuthService) {}

  @Post('login')
  login(@Body() dto: SalesAdminLoginDto) {
    return this.salesAuthService.loginAdmin(dto);
  }

  @UseGuards(SalesAdminGuard)
  @Post('salespeople')
  createSalesperson(
    @Body() dto: CreateSalespersonDto,
    @CurrentSalesUser() admin: { sub: string; login_id: string },
  ) {
    return this.salesAuthService.createSalesperson(dto, admin);
  }

  @UseGuards(SalesAdminGuard)
  @Delete('salespeople/:salespersonId')
  deleteSalesperson(@Param('salespersonId') salespersonId: string) {
    return this.salesAuthService.deleteSalesperson(salespersonId);
  }
}
