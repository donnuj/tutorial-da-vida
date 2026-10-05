import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_IDENTITIES = 10_000;

interface AttemptState {
  failures: number;
  resetAt: number;
}

@Injectable()
export class AuthAttemptLimiter {
  private readonly attempts = new Map<string, AttemptState>();

  assertAllowed(identity: string): void {
    const key = this.normalize(identity);
    const state = this.getActiveState(key);

    if (state && state.failures >= MAX_FAILURES) {
      const retryAfterSeconds = Math.ceil((state.resetAt - this.now()) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Muitas tentativas. Tente novamente mais tarde.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(identity: string): void {
    const key = this.normalize(identity);
    const state = this.getActiveState(key);
    this.enforceCapacity(key);

    this.attempts.set(key, {
      failures: (state?.failures ?? 0) + 1,
      resetAt: state?.resetAt ?? this.now() + WINDOW_MS,
    });
  }

  clear(identity: string): void {
    this.attempts.delete(this.normalize(identity));
  }

  protected now(): number {
    return Date.now();
  }

  private getActiveState(key: string): AttemptState | undefined {
    const state = this.attempts.get(key);
    if (state && state.resetAt <= this.now()) {
      this.attempts.delete(key);
      return undefined;
    }
    return state;
  }

  private normalize(identity: string): string {
    return identity.trim().toLowerCase();
  }

  private enforceCapacity(incomingKey: string): void {
    const threshold = Math.floor(MAX_TRACKED_IDENTITIES * 0.9);
    if (this.attempts.has(incomingKey) || this.attempts.size < threshold) {
      return;
    }

    for (const [key, state] of this.attempts) {
      if (state.resetAt <= this.now()) {
        this.attempts.delete(key);
      }
    }

    if (this.attempts.size >= threshold) {
      const toEvict = Math.ceil(MAX_TRACKED_IDENTITIES * 0.1);
      let evicted = 0;
      for (const key of this.attempts.keys()) {
        if (evicted >= toEvict) break;
        this.attempts.delete(key);
        evicted++;
      }
    }
  }
}
