import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SimulationService } from './simulation.service';

@Controller('simulation')
@UseGuards(JwtAuthGuard)
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('offline-progress')
  getOfflineProgress(@Req() req: { user: { sub: number } }) {
    return this.simulationService.calculateOfflineProgress(req.user.sub);
  }

  @Post('advance-to-adult')
  @HttpCode(204)
  async advanceToAdult(
    @Req() req: { user: { sub: number } },
    @Body() body: { traitDeltas?: Record<string, number> },
  ) {
    await this.simulationService.advanceToAdult(req.user.sub, body.traitDeltas ?? {});
  }
}
