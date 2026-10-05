import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  authResponseSchema,
  authActionResponseSchema,
  type LoginInput,
  type RegisterInput,
} from './auth.schemas';
import { AuthAttemptLimiter } from './auth-attempt-limiter';
import { EmailService } from './email.service';
import { createRefreshToken, hashRefreshToken, parseDuration } from './token-lifecycle';

const DUMMY_PASSWORD_HASH =
  '$2b$10$UvdVyIh7GmAp1VHGPA5JX.ftgUfSmgC4OzU0CwCkWkwye/3mkhhM.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly attemptLimiter: AuthAttemptLimiter,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterInput) {
    const exists = await this.prisma.account.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (exists) throw new ConflictException('Não foi possível concluir o cadastro.');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const account = await this.prisma.account.create({
      data: { email: dto.email, username: dto.username, passwordHash },
      include: { characters: { take: 1 } },
    });

    return this.buildAuthResponse(account);
  }

  async login(dto: LoginInput) {
    this.attemptLimiter.assertAllowed(dto.email);

    const account = await this.prisma.account.findUnique({
      where: { email: dto.email },
      include: { characters: { take: 1 } },
    });

    const valid = await bcrypt.compare(
      dto.password,
      account?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!account || !valid || account.isBanned) {
      this.attemptLimiter.recordFailure(dto.email);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    this.attemptLimiter.clear(dto.email);
    await this.prisma.account.update({
      where: { id: account.id },
      data: { lastLogin: new Date() },
    });

    return this.buildAuthResponse(account);
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { account: { include: { characters: { take: 1 } } } },
    });

    if (!stored) throw new UnauthorizedException('Refresh token inválido ou expirado.');

    const now = new Date();
    if (stored.usedAt || stored.revokedAt) {
      await this.revokeFamily(stored.familyId, now);
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    if (stored.expiresAt <= now || stored.account.isBanned || stored.account.status !== 'active') {
      await this.revokeFamily(stored.familyId, now);
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const nextToken = createRefreshToken();
    const nextHash = hashRefreshToken(nextToken);
    const expiresAt = this.getRefreshExpiration(now);

    const rotated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const consumed = await tx.refreshToken.updateMany({
        where: { id: stored.id, usedAt: null, revokedAt: null },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        await tx.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return false;
      }
      await tx.refreshToken.create({
        data: { tokenHash: nextHash, familyId: stored.familyId, accountId: stored.accountId, expiresAt },
      });
      return true;
    });

    if (!rotated) throw new UnauthorizedException('Refresh token inválido ou expirado.');
    return this.buildAuthResponse(stored.account, nextToken);
  }

  async logout(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
    });
    if (stored) await this.revokeFamily(stored.familyId, new Date());
    return authActionResponseSchema.parse({ success: true });
  }

  async logoutAll(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
    });
    if (stored) {
      await this.prisma.refreshToken.updateMany({
        where: { accountId: stored.accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return authActionResponseSchema.parse({ success: true });
  }

  async forgotPassword(email: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { email } });
    if (!account || account.isBanned) return;

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { accountId: account.id } }),
      this.prisma.passwordResetToken.create({
        data: { tokenHash, accountId: account.id, expiresAt: new Date(Date.now() + 3_600_000) },
      }),
    ]);

    await this.email.sendPasswordReset(account.email, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { account: true },
    });

    if (!stored || stored.usedAt || stored.expiresAt <= new Date()) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      this.prisma.account.update({ where: { id: stored.accountId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { accountId: stored.accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.attemptLimiter.clear(stored.account.email);
  }

  async deleteAccount(accountId: number): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, select: { email: true } });
    if (account) {
      const emailHash = createHash('sha256').update(account.email.toLowerCase()).digest('hex');
      console.error(`[LGPD] account_deletion email_hash=${emailHash} ts=${new Date().toISOString()}`);
    }
    await this.prisma.account.delete({ where: { id: accountId } });
  }

  private async buildAuthResponse(
    account: {
      id: number; email: string; username: string; createdAt: Date; lastLogin: Date;
      isBanned: boolean; status: string;
      characters: { id: number }[];
    },
    existingRefreshToken?: string,
  ) {
    const payload = { sub: account.id, email: account.email, jti: randomUUID() };
    const accessToken = this.jwt.sign(payload);

    const refreshToken = existingRefreshToken ?? createRefreshToken();
    if (!existingRefreshToken) {
      await this.prisma.refreshToken.create({
        data: {
          tokenHash: hashRefreshToken(refreshToken),
          familyId: randomUUID(),
          accountId: account.id,
          expiresAt: this.getRefreshExpiration(new Date()),
        },
      });
    }

    const body = authResponseSchema.parse({
      accessToken,
      profile: {
        id: account.id,
        username: account.username,
        email: account.email,
        registeredAt: account.createdAt.toISOString(),
        lastLogin: account.lastLogin.toISOString(),
        hasCharacter: account.characters.length > 0,
      },
    });

    return { body, refreshToken };
  }

  private getRefreshExpiration(now: Date): Date {
    return new Date(
      now.getTime() + parseDuration(this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN')),
    );
  }

  private async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt },
    });
  }
}
