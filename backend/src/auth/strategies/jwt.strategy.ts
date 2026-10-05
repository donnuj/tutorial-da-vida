import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: number; // account id
  email: string;
  jti: string;
}

function fromCookieOrHeader(req: Request): string | null {
  const cookie = (req.cookies as Record<string, string> | undefined)?.['access_token'];
  if (cookie) return cookie;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: fromCookieOrHeader,
      passReqToCallback: false,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: config.getOrThrow<string>('JWT_ISSUER'),
      audience: config.getOrThrow<string>('JWT_AUDIENCE'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload) {
    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
    });
    if (!account || account.isBanned) throw new UnauthorizedException();
    return { accountId: account.id, email: account.email };
  }
}
