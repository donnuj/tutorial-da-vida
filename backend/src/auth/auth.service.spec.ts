import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthAttemptLimiter } from './auth-attempt-limiter';
import { PrismaService } from '../prisma/prisma.service';
import { createRefreshToken, hashRefreshToken } from './token-lifecycle';
import { EmailService } from './email.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const account = {
  id: 1,
  email: 'player@example.com',
  username: 'player',
  passwordHash: 'hash',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastLogin: new Date('2026-01-02T00:00:00.000Z'),
  status: 'active',
  isBanned: false,
  banReason: null,
  player: {
    id: 10,
    accountId: 1,
    level: 1,
    experience: 0,
    gold: 1000,
    premiumCurrency: 100,
    characterName: 'player',
  },
};

describe('AuthService refresh lifecycle', () => {
  const refreshToken = createRefreshToken();
  const findUnique = jest.fn();
  const revokeMany = jest.fn();
  const transactionUpdateMany = jest.fn();
  const transactionCreate = jest.fn();
  const transactionClient = {
    refreshToken: {
      updateMany: transactionUpdateMany,
      create: transactionCreate,
    },
  };
  const accountFindFirst = jest.fn();
  const accountCreate = jest.fn();
  const accountFindUnique = jest.fn();
  const accountUpdate = jest.fn();
  const refreshCreate = jest.fn();
  const prisma = {
    account: {
      findFirst: accountFindFirst,
      create: accountCreate,
      findUnique: accountFindUnique,
      update: accountUpdate,
    },
    refreshToken: {
      findUnique,
      updateMany: revokeMany,
      create: refreshCreate,
    },
    $transaction: jest.fn(
      async (
        callback: (client: typeof transactionClient) => Promise<boolean>,
      ) => callback(transactionClient),
    ),
  } as unknown as PrismaService;
  const jwt = {
    sign: jest.fn().mockReturnValue('access-token'),
  } as unknown as JwtService;
  const config = {
    getOrThrow: jest.fn().mockReturnValue('7d'),
  } as unknown as ConfigService;
  const email = { sendPasswordReset: jest.fn() } as unknown as EmailService;
  const service = new AuthService(
    prisma,
    jwt,
    new AuthAttemptLimiter(),
    email,
    config,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    refreshCreate.mockResolvedValue({});
  });

  it('cadastra uma conta única e emite a sessão', async () => {
    accountFindFirst.mockResolvedValue(null);
    accountCreate.mockResolvedValue(account);

    const result = await service.register({
      email: account.email,
      username: account.username,
      password: 'Str0ng!Password',
    });

    expect(result.body.accessToken).toBe('access-token');
    expect(accountCreate).toHaveBeenCalled();
    expect(refreshCreate).toHaveBeenCalled();
  });

  it('não revela se email ou username já existe', async () => {
    accountFindFirst.mockResolvedValue(account);

    await expect(
      service.register({
        email: account.email,
        username: account.username,
        password: 'Str0ng!Password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('autentica conta ativa e atualiza o último login', async () => {
    accountFindUnique.mockResolvedValue(account);
    accountUpdate.mockResolvedValue(account);

    await expect(
      service.login({
        email: account.email,
        password: 'Str0ng!Password',
      }),
    ).resolves.toMatchObject({ body: { accessToken: 'access-token' } });
    expect(accountUpdate).toHaveBeenCalled();
  });

  it.each([
    [null, true],
    [account, false],
    [{ ...account, isBanned: true }, true],
  ])(
    'rejeita credenciais inválidas sem enumerar contas',
    async (found, valid) => {
      accountFindUnique.mockResolvedValue(found);
      (bcrypt.compare as jest.Mock).mockResolvedValue(valid);

      await expect(
        service.login({
          email: account.email,
          password: 'invalid-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('rejeita refresh token desconhecido', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('busca somente o hash e rotaciona o token de forma atômica', async () => {
    findUnique.mockResolvedValue({
      id: 20,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: 'family-1',
      accountId: account.id,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      account,
    });
    transactionUpdateMany.mockResolvedValue({ count: 1 });
    transactionCreate.mockResolvedValue({});

    const result = await service.refresh(refreshToken);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashRefreshToken(refreshToken) },
      }),
    );
    const serializedCreate = JSON.stringify(
      transactionCreate.mock.calls[0] as unknown,
    );
    expect(serializedCreate).toContain('"familyId":"family-1"');
    expect(serializedCreate).toContain('"tokenHash":');
    expect(serializedCreate).not.toContain(refreshToken);
    expect(result.refreshToken).not.toBe(refreshToken);
    expect(result.body.accessToken).toBeTruthy();
  });

  it('revoga toda a família quando um token usado reaparece', async () => {
    findUnique.mockResolvedValue({
      id: 20,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: 'family-1',
      accountId: account.id,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      usedAt: new Date(),
      revokedAt: null,
      createdAt: new Date(),
      account,
    });
    revokeMany.mockResolvedValue({ count: 2 });

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const serializedRevocation = JSON.stringify(
      revokeMany.mock.calls[0] as unknown,
    );
    expect(serializedRevocation).toContain('"familyId":"family-1"');
    expect(serializedRevocation).toContain('"revokedAt":');
  });

  it('revoga a sessão de conta banida', async () => {
    findUnique.mockResolvedValue({
      id: 20,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: 'family-1',
      accountId: account.id,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      account: { ...account, isBanned: true },
    });
    revokeMany.mockResolvedValue({ count: 1 });

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(revokeMany).toHaveBeenCalled();
  });

  it('revoga a família quando perde uma corrida de rotação', async () => {
    findUnique.mockResolvedValue({
      id: 20,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: 'family-1',
      accountId: account.id,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      account,
    });
    transactionUpdateMany.mockResolvedValue({ count: 0 });

    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(transactionCreate).not.toHaveBeenCalled();
  });

  it('revoga a família no logout atual', async () => {
    findUnique.mockResolvedValue({
      familyId: 'family-1',
      accountId: account.id,
    });
    revokeMany.mockResolvedValue({ count: 2 });

    await expect(service.logout(refreshToken)).resolves.toEqual({
      success: true,
    });
    expect(JSON.stringify(revokeMany.mock.calls[0] as unknown)).toContain(
      '"familyId":"family-1"',
    );
  });

  it('revoga todas as sessões da conta no logout global', async () => {
    findUnique.mockResolvedValue({
      familyId: 'family-1',
      accountId: account.id,
    });
    revokeMany.mockResolvedValue({ count: 4 });

    await expect(service.logoutAll(refreshToken)).resolves.toEqual({
      success: true,
    });
    expect(JSON.stringify(revokeMany.mock.calls[0] as unknown)).toContain(
      `"accountId":${account.id}`,
    );
  });

  it('mantém logout idempotente para token desconhecido', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.logout(refreshToken)).resolves.toEqual({
      success: true,
    });
    await expect(service.logoutAll(refreshToken)).resolves.toEqual({
      success: true,
    });
    expect(revokeMany).not.toHaveBeenCalled();
  });
});
