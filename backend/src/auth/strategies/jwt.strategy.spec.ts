import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy, type JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  const findUnique = jest.fn();
  const prisma = {
    account: { findUnique },
  } as unknown as PrismaService;
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        JWT_SECRET: 's'.repeat(64),
        JWT_ISSUER: 'gacha-infinite',
        JWT_AUDIENCE: 'gacha-client',
      };
      const value = values[key];
      if (!value) throw new Error(`Configuração ausente: ${key}`);
      return value;
    }),
  } as unknown as ConfigService;
  const strategy = new JwtStrategy(prisma, config);
  const payload: JwtPayload = {
    sub: 10,
    email: 'claim@example.com',
    jti: 'token-id',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolve a identidade com dados atuais do banco', async () => {
    findUnique.mockResolvedValue({
      id: 10,
      email: 'current@example.com',
      isBanned: false,
    });

    await expect(strategy.validate(payload)).resolves.toEqual({
      accountId: 10,
      email: 'current@example.com',
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: payload.sub } });
  });

  it.each([null, { id: 10, email: payload.email, isBanned: true }])(
    'rejeita conta inexistente ou banida',
    async (account) => {
      findUnique.mockResolvedValue(account);

      await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );
});
