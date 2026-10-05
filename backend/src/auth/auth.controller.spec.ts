import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

const mockCookieResponse = () => {
  const res = { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response;
  return res;
};

const mockCookieRequest = (refreshToken?: string) => {
  const req = {
    cookies: refreshToken ? { refresh_token: refreshToken } : {},
  } as unknown as Request;
  return req;
};

describe('AuthController', () => {
  const register = jest.fn().mockResolvedValue({ body: {}, refreshToken: 'tok' });
  const login = jest.fn().mockResolvedValue({ body: {}, refreshToken: 'tok' });
  const refresh = jest.fn().mockResolvedValue({ body: {}, refreshToken: 'tok2' });
  const logout = jest.fn().mockResolvedValue({ success: true });
  const logoutAll = jest.fn().mockResolvedValue({ success: true });

  const authService = { register, login, refresh, logout, logoutAll } as unknown as AuthService;
  const configService = {
    get: () => ['http://localhost:3001'],
  } as unknown as ConfigService<Record<string, unknown>, true>;

  const controller = new AuthController(authService, configService);

  beforeEach(() => jest.clearAllMocks());

  it('delega cadastro e login, seta cookie de refresh', async () => {
    const res = mockCookieResponse();
    const registerInput = {
      email: 'player@example.com',
      username: 'player',
      password: 'Str0ng!Password14',
    };
    const loginInput = { email: registerInput.email, password: registerInput.password };

    await controller.register(registerInput, res);
    await controller.login(loginInput, res);

    expect(register).toHaveBeenCalledWith(registerInput);
    expect(login).toHaveBeenCalledWith(loginInput);
    expect(res.cookie).toHaveBeenCalledTimes(2);
  });

  it('refresh lê cookie e gira token', async () => {
    const res = mockCookieResponse();
    const req = mockCookieRequest('a'.repeat(64));

    await controller.refresh(req, res);

    expect(refresh).toHaveBeenCalledWith('a'.repeat(64));
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });

  it('logout lê cookie e limpa', async () => {
    const res = mockCookieResponse();
    const req = mockCookieRequest('a'.repeat(64));

    await controller.logout(req, res);
    await controller.logoutAll(req, res);

    expect(logout).toHaveBeenCalledWith('a'.repeat(64));
    expect(logoutAll).toHaveBeenCalledWith('a'.repeat(64));
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('refresh sem cookie lança UnauthorizedException', async () => {
    const res = mockCookieResponse();
    const req = mockCookieRequest(); // sem cookie

    await expect(controller.refresh(req, res)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
