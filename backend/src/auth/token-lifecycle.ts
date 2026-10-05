import { createHash, randomBytes } from 'node:crypto';

const DURATION_PATTERN = /^(?<amount>[1-9]\d*)(?<unit>ms|s|m|h|d|w)$/;
const UNIT_IN_MILLISECONDS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
} as const;

export function createRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function parseDuration(duration: string): number {
  const match = DURATION_PATTERN.exec(duration);
  const amount = match?.groups?.amount;
  const unit = match?.groups?.unit as
    keyof typeof UNIT_IN_MILLISECONDS | undefined;

  if (!amount || !unit) throw new Error(`Duração inválida: ${duration}`);
  return Number(amount) * UNIT_IN_MILLISECONDS[unit];
}
