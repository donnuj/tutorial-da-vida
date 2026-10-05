import { Controller, Post, Req, UseGuards } from '@nestjs/common';
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
}
