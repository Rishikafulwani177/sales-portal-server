import { Body, Controller, Post } from '@nestjs/common';
import { SalespersonLoginDto } from '../dto/salesperson-login.dto';
import { SalesAuthService } from '../salesAuth.service';

@Controller('sales-auth/salesperson')
export class SalesController {
  constructor(private salesAuthService: SalesAuthService) {}

  @Post('login')
  login(@Body() dto: SalespersonLoginDto) {
    return this.salesAuthService.loginSalesperson(dto);
  }
}
