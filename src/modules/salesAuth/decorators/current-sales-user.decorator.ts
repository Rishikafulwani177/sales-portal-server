import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentSalesUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.salesUser;
  },
);
