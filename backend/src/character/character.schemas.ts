import { z } from 'zod';

export const createCharacterSchema = z.object({
  name: z.string().trim().min(2).max(32),
}).strict();

export const characterStateSchema = z.object({
  id: z.number(),
  name: z.string(),
  generation: z.number(),
  alive: z.boolean(),
  gameAge: z.number(),
  phase: z.string(),
  // attributes
  intelligence: z.number(),
  education: z.number(),
  discipline: z.number(),
  health: z.number(),
  energy: z.number(),
  happiness: z.number(),
  stress: z.number(),
  sociability: z.number(),
  reputation: z.number(),
  financialKnowledge: z.number(),
  // economy
  money: z.number(),
  monthlyIncome: z.number(),
  monthlyExpenses: z.number(),
  // world
  locationId: z.string(),
  currentActivity: z.string().nullable(),
  activityEndsAt: z.string().nullable(),
  // career
  jobId: z.string().nullable(),
  jobTitle: z.string().nullable(),
  jobExperience: z.number(),
  studyProgress: z.number(),
  studyTarget: z.string().nullable(),
});

export const performActionSchema = z.object({
  action: z.enum(['work', 'study', 'sleep', 'shop', 'visit', 'idle']),
  targetId: z.string().optional(),
  targetLocationId: z.string().optional(),
}).strict();

export const saveUploadSchema = z.object({
  revision: z.number().int().min(0),
  data: z.record(z.string(), z.unknown()),
}).strict();

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type PerformActionInput = z.infer<typeof performActionSchema>;
export type SaveUpload = z.infer<typeof saveUploadSchema>;
