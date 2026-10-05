import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CharacterService } from './character.service';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import {
  createCharacterSchema,
  performActionSchema,
  saveUploadSchema,
  type CreateCharacterInput,
  type PerformActionInput,
  type SaveUpload,
} from './character.schemas';

@Controller('character')
@UseGuards(JwtAuthGuard)
export class CharacterController {
  constructor(private readonly characterService: CharacterService) {}

  @Post()
  create(
    @Req() req: { user: { sub: number } },
    @Body(new ZodValidationPipe(createCharacterSchema)) dto: CreateCharacterInput,
  ) {
    return this.characterService.createCharacter(req.user.sub, dto);
  }

  @Get('state')
  getState(@Req() req: { user: { sub: number } }) {
    return this.characterService.getState(req.user.sub);
  }

  @Post('action')
  performAction(
    @Req() req: { user: { sub: number } },
    @Body(new ZodValidationPipe(performActionSchema)) dto: PerformActionInput,
  ) {
    return this.characterService.performAction(req.user.sub, dto);
  }

  @Post('action/complete')
  completeActivity(@Req() req: { user: { sub: number } }) {
    return this.characterService.completeActivity(req.user.sub);
  }

  @Get('save')
  downloadSave(@Req() req: { user: { sub: number } }) {
    return this.characterService.downloadSave(req.user.sub);
  }

  @Put('save')
  uploadSave(
    @Req() req: { user: { sub: number } },
    @Body(new ZodValidationPipe(saveUploadSchema)) dto: SaveUpload,
  ) {
    return this.characterService.uploadSave(req.user.sub, dto);
  }
}
