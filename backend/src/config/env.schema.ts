import { z } from 'zod';

const durationSchema = z
  .string()
  .regex(/^[1-9]\d*(?:ms|s|m|h|d|w|y)$/, 'duração inválida');

const secretSchema = z
  .string()
  .min(32, 'deve ter no mínimo 32 caracteres')
  .refine((s) => new Set(s).size >= 12, 'deve ter diversidade suficiente de caracteres');

const corsOriginsSchema = z.string().min(1).transform((value, ctx) => {
  const origins = value.split(',').map((o) => o.trim());
  const result = z.array(z.url()).min(1).safeParse(origins);
  if (!result.success) {
    ctx.addIssue({ code: 'custom', message: 'CORS_ORIGINS contém uma origem inválida' });
    return z.NEVER;
  }
  return result.data;
});

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().refine(
    (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
    'PostgreSQL é obrigatório',
  ),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: secretSchema,
  JWT_EXPIRES_IN: durationSchema.default('1h'),
  JWT_REFRESH_EXPIRES_IN: durationSchema.default('7d'),
  JWT_ISSUER: z.string().min(1).default('tutorial-da-vida-api'),
  JWT_AUDIENCE: z.string().min(1).default('tutorial-da-vida-web'),
  CORS_ORIGINS: corsOriginsSchema,
  ADMIN_EMAILS: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default('noreply@tutorialdavida.app'),
  FRONTEND_URL: z.string().url().default('https://tutorialdavida.pages.dev'),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuração de ambiente inválida: ${details}`);
  }
  return result.data;
}
