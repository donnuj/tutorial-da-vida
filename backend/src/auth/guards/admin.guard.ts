import { Injectable, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

@Injectable()
export class AdminGuard extends AuthGuard('jwt') {
  handleRequest<T extends { email: string }>(err: unknown, user: T | null): T {
    if (err || !user) throw (err as Error) ?? new ForbiddenException('Acesso negado.');
    if (!ADMIN_EMAILS.includes(user.email.toLowerCase()))
      throw new ForbiddenException('Acesso negado.');
    return user;
  }
}
