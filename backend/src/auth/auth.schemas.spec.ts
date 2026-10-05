import { loginSchema, refreshSchema, registerSchema } from './auth.schemas';

describe('contratos de autenticação', () => {
  it('normaliza email e username no cadastro', () => {
    expect(
      registerSchema.parse({
        email: ' Player@Example.COM ',
        password: 'Uma-Senha-Forte-123!',
        username: '  Player_01  ',
      }),
    ).toEqual({
      email: 'player@example.com',
      password: 'Uma-Senha-Forte-123!',
      username: 'Player_01',
    });
  });

  it.each([
    ['email inválido', { email: 'invalid', password: 'Uma-Senha-Forte-123!' }],
    [
      'campo desconhecido',
      {
        email: 'a@b.com',
        password: 'Uma-Senha-Forte-123!',
        admin: true,
      },
    ],
  ])('rejeita login com %s', (_scenario, input) => {
    expect(loginSchema.safeParse(input).success).toBe(false);
  });

  it('rejeita username fora do contrato', () => {
    expect(
      registerSchema.safeParse({
        email: 'a@b.com',
        password: 'Uma-Senha-Forte-123!',
        username: '<script>',
      }).success,
    ).toBe(false);
  });

  it('aceita somente refresh token opaco no formato esperado', () => {
    expect(
      refreshSchema.safeParse({
        refreshToken:
          'dG9rZW4tc2VndXJvLWNvbS02NC1jYXJhY3RlcmVzLW91LW1haXMteHh4eHh4eHh4eA',
      }).success,
    ).toBe(true);
    expect(
      refreshSchema.safeParse({ refreshToken: 'token-inválido' }).success,
    ).toBe(false);
  });
});
