import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => {
        await this.prisma.$executeRaw`SELECT 1`;
        return { database: { status: 'up' as const } };
      },
    ]);
  }
}
