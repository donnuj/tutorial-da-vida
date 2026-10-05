jest.mock('@nestjs/terminus', () => ({
  HealthCheckService: class {},
  HealthCheck: () => () => {},
  HealthCheckResult: class {},
}));
jest.mock('@nestjs/throttler', () => ({
  SkipThrottle: () => () => {},
  ThrottlerGuard: class {},
}));
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  it('confirma que o processo está pronto para receber tráfego', async () => {
    const mockHealth = {
      check: jest.fn().mockResolvedValue({ status: 'ok', info: { database: { status: 'up' } }, error: {}, details: { database: { status: 'up' } } }),
    } as unknown as HealthCheckService;

    const mockPrisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    } as unknown as PrismaService;

    const controller = new HealthController(mockHealth, mockPrisma);
    const result = await controller.check();
    expect(result.status).toBe('ok');
  });
});
