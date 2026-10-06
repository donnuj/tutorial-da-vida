import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OfflineResult {
  timeElapsedMinutes: number;
  moneyEarned: number;
  moneySpent: number;
  energyChange: number;
  events: OfflineEvent[];
}

export interface OfflineEvent {
  type: string;
  description: string;
  delta: Record<string, number>;
}

// Game time: 1 real second = 1 game minute
const REAL_MS_PER_GAME_MINUTE = 1000;

@Injectable()
export class SimulationService {
  constructor(private readonly prisma: PrismaService) {}

  async advanceGameTime(characterId: number, realMsElapsed: number): Promise<{ gameMinutesAdvanced: number }> {
    const gameMinutes = Math.floor(realMsElapsed / REAL_MS_PER_GAME_MINUTE);
    if (gameMinutes === 0) return { gameMinutesAdvanced: 0 };

    await this.prisma.character.update({
      where: { id: characterId },
      data: {
        gameAge: { increment: gameMinutes },
        gameTimestamp: new Date(),
      },
    });

    return { gameMinutesAdvanced: gameMinutes };
  }

  async calculateOfflineProgress(accountId: number): Promise<OfflineResult> {
    const character = await this.prisma.character.findFirst({
      where: { accountId, alive: true },
      include: { saveData: true },
    });

    if (!character) return this.emptyResult();

    const lastOnline = character.saveData?.lastOnline ?? character.createdAt;
    const nowMs = Date.now();
    const lastOnlineMs = lastOnline.getTime();
    const realMsElapsed = Math.max(0, nowMs - lastOnlineMs);
    const gameMinutesElapsed = Math.floor(realMsElapsed / REAL_MS_PER_GAME_MINUTE);

    if (gameMinutesElapsed < 1) return this.emptyResult();

    // Cap offline simulation at 7 real days
    const cappedMinutes = Math.min(gameMinutesElapsed, 7 * 24 * 60);
    const gameDays = cappedMinutes / (24 * 60);

    const events: OfflineEvent[] = [];
    let moneyEarned = 0;
    let moneySpent = 0;

    // Monthly income/expense (prorated)
    if (character.monthlyIncome.toNumber() > 0) {
      const income = (character.monthlyIncome.toNumber() / 30) * gameDays;
      moneyEarned += income;
      events.push({
        type: 'income',
        description: `Salário recebido`,
        delta: { money: income },
      });
    }

    const expenses = (character.monthlyExpenses.toNumber() / 30) * gameDays;
    moneySpent += expenses;
    events.push({
      type: 'expenses',
      description: `Despesas do período`,
      delta: { money: -expenses },
    });

    const netMoney = moneyEarned - moneySpent;

    await this.prisma.character.update({
      where: { id: character.id },
      data: {
        money: { increment: netMoney },
        gameAge: { increment: cappedMinutes },
        gameTimestamp: new Date(),
      },
    });

    if (character.saveData) {
      await this.prisma.characterSave.update({
        where: { characterId: character.id },
        data: { lastOnline: new Date() },
      });
    }

    return {
      timeElapsedMinutes: cappedMinutes,
      moneyEarned,
      moneySpent,
      energyChange: -Math.min(50, gameDays * 5),
      events,
    };
  }

  async advanceToAdult(accountId: number, traitDeltas: Record<string, number> = {}) {
    const character = await this.prisma.character.findFirst({
      where: { accountId, alive: true },
    });
    if (!character) throw new NotFoundException('Personagem não encontrado.');
    if (character.phase === 'adult') throw new BadRequestException('Personagem já é adulto.');

    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    const adultGameAge = 18 * 365 * 24 * 60;

    await this.prisma.character.update({
      where: { id: character.id },
      data: {
        phase: 'adult',
        gameAge: adultGameAge,
        gameTimestamp: new Date(),
        intelligence:       clamp(Number(character.intelligence)       + (traitDeltas.intelligence       ?? 0)),
        education:          clamp(Number(character.education)          + (traitDeltas.education          ?? 0)),
        discipline:         clamp(Number(character.discipline)         + (traitDeltas.discipline         ?? 0)),
        happiness:          clamp(Number(character.happiness)          + (traitDeltas.happiness          ?? 0)),
        creativity:         clamp(Number(character.creativity)         + (traitDeltas.creativity         ?? 0)),
        financialKnowledge: clamp(Number(character.financialKnowledge) + (traitDeltas.financialKnowledge ?? 0)),
        reputation:         clamp(Number(character.reputation)         + (traitDeltas.reputation         ?? 0)),
        ...(traitDeltas.money ? { money: { increment: traitDeltas.money } } : {}),
      },
    });
  }

  private emptyResult(): OfflineResult {
    return { timeElapsedMinutes: 0, moneyEarned: 0, moneySpent: 0, energyChange: 0, events: [] };
  }
}
