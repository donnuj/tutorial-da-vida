import {
  Body,
  Controller,
  Delete,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  deleteAccountSchema,
  type LoginInput,
  type RegisterInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type DeleteAccountInput,
} from './auth.schemas';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';

const REFRESH_COOKIE = 'refresh_token';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function getRefreshFromCookie(req: Request): string {
  const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  if (!token) throw new UnauthorizedException('Refresh token ausente.');
  return token;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) input: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body, refreshToken } = await this.authService.register(input);
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
    return body;
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body, refreshToken } = await this.authService.login(input);
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
    return body;
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = getRefreshFromCookie(req);
    const { body, refreshToken } = await this.authService.refresh(token);
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
    return body;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = getRefreshFromCookie(req);
    res.clearCookie(REFRESH_COOKIE, { ...COOKIE_OPTS, maxAge: undefined });
    return this.authService.logout(token);
  }

  @Post('logout-all')
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = getRefreshFromCookie(req);
    res.clearCookie(REFRESH_COOKIE, { ...COOKIE_OPTS, maxAge: undefined });
    return this.authService.logoutAll(token);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('forgot-password')
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) input: ForgotPasswordInput,
  ) {
    await this.authService.forgotPassword(input.email);
    return { success: true };
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('reset-password')
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) input: ResetPasswordInput,
  ) {
    await this.authService.resetPassword(input.token, input.password);
    return { success: true };
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @Req() req: Request & { user: { sub: number } },
    @Body(new ZodValidationPipe(deleteAccountSchema)) _input: DeleteAccountInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteAccount((req.user as { sub: number }).sub);
    res.clearCookie(REFRESH_COOKIE, { ...COOKIE_OPTS, maxAge: undefined });
    return { success: true };
  }
}
