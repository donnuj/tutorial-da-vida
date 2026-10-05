import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCharacterInput, PerformActionInput, SaveUpload } from './character.schemas';
import { characterStateSchema } from './character.schemas';

// Game time: 1 real minute = 60 game minutes (1 game hour)
// 1 game day = 24 real minutes
// 1 game year = 24 * 365 ≈ 8760 real minutes ≈ 146 real hours
// Adulthood at game age 18 years = 18 * 365 days = 6570 game days
const GAME_MINUTES_PER_REAL_SECOND = 1;
const ADULT_AGE_GAME_MINUTES = 18 * 365 * 24 * 60;

const ACTION_DURATIONS: Record<string, number> = {
  work: 480,     // 8 game hours
  study: 240,    // 4 game hours
  sleep: 480,    // 8 game hours
  shop: 60,      // 1 game hour
  visit: 120,    // 2 game hours
  idle: 60,
};

@Injectable()
export class CharacterService {
  constructor(private readonly prisma: PrismaService) {}

  async createCharacter(accountId: number, dto: CreateCharacterInput) {
    const existing = await this.prisma.character.findFirst({ where: { accountId, alive: true } });
    if (existing) throw new ConflictException('Já existe um personagem ativo nesta conta.');

    const character = await this.prisma.character.create({
      data: {
        accountId,
        name: dto.name,
        energy: 100,
        health: 100,
        happiness: 70,
        money: 0,
        phase: 'childhood',
      },
    });

    return this.mapToState(character);
  }

  async getState(accountId: number) {
    const character = await this.findActiveCharacter(accountId);
    return this.mapToState(character);
  }

  async performAction(accountId: number, dto: PerformActionInput) {
    const character = await this.findActiveCharacter(accountId);

    if (character.currentActivity && character.activityEndsAt && character.activityEndsAt > new Date()) {
      throw new BadRequestException('Personagem já está executando uma atividade.');
    }

    const durationMinutes = ACTION_DURATIONS[dto.action] ?? 60;
    const activityEndsAt = new Date(Date.now() + (durationMinutes * 1000) / GAME_MINUTES_PER_REAL_SECOND);

    const updates: Record<string, unknown> = {
      currentActivity: dto.action,
      activityEndsAt,
      activityData: JSON.stringify({ targetId: dto.targetId, targetLocationId: dto.targetLocationId }),
    };

    if (dto.targetLocationId) {
      updates.locationId = dto.targetLocationId;
    }

    const updated = await this.prisma.character.update({
      where: { id: character.id },
      data: updates,
    });

    return this.mapToState(updated);
  }

  async completeActivity(accountId: number) {
    const character = await this.findActiveCharacter(accountId);
    if (!character.currentActivity) return this.mapToState(character);

    const rewards = this.calculateActivityRewards(character);

    const updated = await this.prisma.character.update({
      where: { id: character.id },
      data: {
        currentActivity: null,
        activityEndsAt: null,
        activityData: null,
        energy: Math.max(0, Math.min(100, character.energy + rewards.energy)),
        happiness: Math.max(0, Math.min(100, character.happiness + rewards.happiness)),
        stress: Math.max(0, Math.min(100, character.stress + rewards.stress)),
        money: { increment: rewards.money },
        jobExperience: { increment: rewards.jobExperience },
        studyProgress: { increment: rewards.studyProgress },
        education: Math.min(100, character.education + rewards.education),
      },
    });

    return { state: this.mapToState(updated), rewards };
  }

  async downloadSave(accountId: number) {
    const character = await this.findActiveCharacter(accountId);
    const save = await this.prisma.characterSave.findUnique({ where: { characterId: character.id } });
    if (!save) return { revision: 0, data: null };

    return {
      revision: save.revision,
      data: JSON.parse(save.data),
    };
  }

  async uploadSave(accountId: number, input: SaveUpload) {
    const character = await this.findActiveCharacter(accountId);
    const existing = await this.prisma.characterSave.findUnique({ where: { characterId: character.id } });

    if (existing && input.revision === 0) {
      throw new ConflictException('Save já existe. Baixe o save atual antes de sobrescrever.');
    }
    if (existing && input.revision !== existing.revision) {
      throw new ConflictException('Revisão desatualizada. Baixe o save atual primeiro.');
    }

    const data = JSON.stringify(input.data);
    const checksum = createHash('sha256').update(data).digest('hex');
    const revision = (existing?.revision ?? 0) + 1;

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.characterSave.update({
          where: { characterId: character.id },
          data: { schemaVersion: 1, revision, checksum, data, lastOnline: new Date() },
        }),
        this.prisma.characterSaveAudit.create({
          data: { characterId: character.id, revision, checksum },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.characterSave.create({
          data: { characterId: character.id, schemaVersion: 1, revision, checksum, data },
        }),
        this.prisma.characterSaveAudit.create({
          data: { characterId: character.id, revision, checksum },
        }),
      ]);
    }

    return { revision, checksum };
  }

  private async findActiveCharacter(accountId: number) {
    const character = await this.prisma.character.findFirst({
      where: { accountId, alive: true },
    });
    if (!character) throw new NotFoundException('Nenhum personagem ativo encontrado.');
    return character;
  }

  private calculateActivityRewards(character: { currentActivity: string | null; energy: number }) {
    const rewards = { energy: 0, happiness: 0, stress: 0, money: 0, jobExperience: 0, studyProgress: 0, education: 0 };

    switch (character.currentActivity) {
      case 'work':
        rewards.money = 50 + Math.random() * 30;
        rewards.energy = -20;
        rewards.stress = 10;
        rewards.happiness = -5;
        rewards.jobExperience = 5;
        break;
      case 'study':
        rewards.energy = -15;
        rewards.stress = 5;
        rewards.studyProgress = 10;
        rewards.education = 2;
        rewards.happiness = -5;
        break;
      case 'sleep':
        rewards.energy = 70;
        rewards.stress = -20;
        rewards.happiness = 10;
        break;
      case 'shop':
        rewards.money = -30;
        rewards.happiness = 15;
        rewards.energy = -5;
        break;
      case 'visit':
        rewards.happiness = 20;
        rewards.stress = -10;
        rewards.energy = -5;
        break;
    }

    return rewards;
  }

  private mapToState(c: Record<string, unknown>) {
    return characterStateSchema.parse({
      id: c.id,
      name: c.name,
      generation: c.generation,
      alive: c.alive,
      gameAge: c.gameAge,
      phase: c.phase,
      intelligence: c.intelligence,
      education: c.education,
      discipline: c.discipline,
      health: c.health,
      energy: c.energy,
      happiness: c.happiness,
      stress: c.stress,
      sociability: c.sociability,
      reputation: c.reputation,
      financialKnowledge: c.financialKnowledge,
      money: parseFloat(String(c.money ?? 0)),
      monthlyIncome: parseFloat(String(c.monthlyIncome ?? 0)),
      monthlyExpenses: parseFloat(String(c.monthlyExpenses ?? 0)),
      locationId: c.locationId,
      currentActivity: c.currentActivity,
      activityEndsAt: c.activityEndsAt ? (c.activityEndsAt as Date).toISOString() : null,
      jobId: c.jobId,
      jobTitle: c.jobTitle,
      jobExperience: c.jobExperience,
      studyProgress: c.studyProgress,
      studyTarget: c.studyTarget,
    });
  }
}
