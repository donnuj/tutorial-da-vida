import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env.schema';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string | undefined;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(config: ConfigService<Environment, true>) {
    this.apiKey = config.get('RESEND_API_KEY', { infer: true });
    this.from = config.get('EMAIL_FROM', { infer: true })!;
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true })!;
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY não configurado — e-mail de reset ignorado');
      return;
    }

    const url = `${this.frontendUrl}/reset-password?token=${token}`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Transcend Infinity <${this.from}>`,
        to: [to],
        subject: 'Redefinição de senha — Transcend Infinity',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#06070f;color:#e8d9a0;padding:32px;border-radius:12px;">
            <h2 style="font-size:20px;font-weight:900;margin:0 0 8px;color:#c89b3c;letter-spacing:.15em;">TRANSCEND INFINITY</h2>
            <p style="font-size:13px;color:#7a6fa0;margin:0 0 24px;">Redefinição de senha</p>
            <p style="font-size:14px;margin:0 0 20px;">Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>
            <a href="${url}"
               style="display:inline-block;background:#c89b3c;color:#06070f;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:900;font-size:13px;letter-spacing:.1em;">
              REDEFINIR SENHA
            </a>
            <p style="font-size:11px;color:#7a6fa0;margin-top:28px;">
              Se você não solicitou esta redefinição, ignore este e-mail. Sua senha não foi alterada.
            </p>
          </div>`,
      }),
    }).catch((err: unknown) => {
      this.logger.error('Falha ao enviar e-mail via Resend', err);
    });
  }
}
