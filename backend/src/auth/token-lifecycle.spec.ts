import {
  createRefreshToken,
  hashRefreshToken,
  parseDuration,
} from './token-lifecycle';

describe('token lifecycle', () => {
  it('gera refresh tokens opacos, fortes e únicos', () => {
    const first = createRefreshToken();
    const second = createRefreshToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(64);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produz hash SHA-256 determinístico sem armazenar o token', () => {
    const token = createRefreshToken();
    const hash = hashRefreshToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
    expect(hash).not.toContain(token);
    expect(hashRefreshToken(token)).toBe(hash);
  });

  it.each([
    ['15m', 15 * 60 * 1000],
    ['1h', 60 * 60 * 1000],
    ['7d', 7 * 24 * 60 * 60 * 1000],
  ])('converte a duração %s', (duration, expected) => {
    expect(parseDuration(duration)).toBe(expected);
  });

  it('rejeita duração inválida', () => {
    expect(() => parseDuration('amanhã')).toThrow('Duração inválida');
  });
});
