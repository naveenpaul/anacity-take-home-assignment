import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthedUser = { id: string; email: string };

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthedUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as AuthedUser;
});
