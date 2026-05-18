import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SalesAdminGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (!token) throw new UnauthorizedException('Missing sales admin token');

    try {
      const payload = this.jwtService.verify(token);

      if (
        payload?.auth_area !== 'sales_portal' ||
        payload?.role !== 'sales_admin'
      ) {
        throw new UnauthorizedException('Sales admin access required');
      }

      request.salesUser = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid sales admin token');
    }
  }
}
