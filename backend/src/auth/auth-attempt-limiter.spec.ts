import { HttpException } from '@nestjs/common';
import { AuthAttemptLimiter } from './auth-attempt-limiter';

class TestAuthAttemptLimiter extends AuthAttemptLimiter {
  currentTime = 1_000_000;

  protected override now(): number {
    return this.currentTime;
  }
}

describe('AuthAttemptLimiter', () => {
  let limiter: TestAuthAttemptLimiter;

  beforeEach(() => {
    limiter = new TestAuthAttemptLimiter();
  });

  it('normaliza a identidade antes de contar falhas', () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.recordFailure(' Player@Example.COM ');
    }

    expect(() => limiter.assertAllowed('player@example.com')).toThrow(
      HttpException,
    );
  });

  it('bloqueia após cinco falhas dentro da janela', () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.assertAllowed('player@example.com');
      limiter.recordFailure('player@example.com');
    }

    try {
      limiter.assertAllowed('player@example.com');
      throw new Error('O limitador deveria bloquear a identidade.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);
      if (error instanceof HttpException) {
        expect(error.getStatus()).toBe(429);
      }
    }
  });

  it('libera automaticamente depois da janela', () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.recordFailure('player@example.com');
    }

    limiter.currentTime += 15 * 60 * 1000;

    expect(() => limiter.assertAllowed('player@example.com')).not.toThrow();
  });

  it('limpa as falhas depois de uma autenticação válida', () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      limiter.recordFailure('player@example.com');
    }

    limiter.clear('player@example.com');

    expect(() => limiter.assertAllowed('player@example.com')).not.toThrow();
  });

  it('mantém identidades independentes', () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.recordFailure('blocked@example.com');
    }

    expect(() => limiter.assertAllowed('other@example.com')).not.toThrow();
  });

  it('limita a memória usada por identidades distintas', () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.recordFailure('oldest@example.com');
    }
    for (let index = 0; index < 10_000; index += 1) {
      limiter.recordFailure(`player-${index}@example.com`);
    }

    expect(() => limiter.assertAllowed('oldest@example.com')).not.toThrow();
  });
});
