import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128)
  .refine((p) => /[a-z]/.test(p), 'Deve conter ao menos uma letra minúscula')
  .refine((p) => /[A-Z]/.test(p), 'Deve conter ao menos uma letra maiúscula')
  .refine((p) => /[0-9]/.test(p), 'Deve conter ao menos um número');
const loginPasswordSchema = z.string().min(1).max(128);
const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[\p{L}\p{N}_-]+$/u);

export const loginSchema = z
  .object({ email: emailSchema, password: loginPasswordSchema })
  .strict();

export const registerSchema = z
  .object({ email: emailSchema, username: usernameSchema, password: passwordSchema })
  .strict();

export const accountProfileSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  registeredAt: z.string(),
  lastLogin: z.string(),
  hasCharacter: z.boolean(),
});

export const authResponseSchema = z.object({
  accessToken: z.string().min(1),
  profile: accountProfileSchema,
});

export const refreshTokenSchema = z
  .string()
  .min(64)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const authActionResponseSchema = z.object({ success: z.literal(true) });

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z
  .object({ token: z.string().min(32).max(128), password: passwordSchema })
  .strict();

export const deleteAccountSchema = z
  .object({ confirmation: z.literal('EXCLUIR') })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
