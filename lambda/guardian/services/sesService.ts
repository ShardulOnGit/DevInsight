/**
 * @file lambda/guardian/services/sesService.ts
 * @description Amazon SES integration — delivers the morning brief email.
 *
 * Design:
 *   - Accepts pre-rendered HTML + text: content concerns stay in emailBuilder.ts.
 *   - Returns Result<string> (MessageId) so the pipeline logs delivery status.
 *   - SES client is reused across warm invocations (module-level singleton).
 *
 * Prerequisites (handled at infrastructure layer, not here):
 *   - Sender address must be verified in SES (or domain-verified).
 *   - In SES sandbox mode, recipient addresses must also be verified.
 *   - Lambda IAM role must have ses:SendEmail on the sender identity.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { SesConfig, SendEmailParams } from '../types.ts';
import type { Result } from '../utils/result.ts';
import { ok, err, tryAsync } from '../utils/result.ts';

// ─── Service Interface ────────────────────────────────────────────────────────

export interface ISesService {
  /**
   * Sends a transactional email via Amazon SES.
   * @returns Result<MessageId> — the SES message ID on success.
   */
  sendEmail(params: SendEmailParams): Promise<Result<string>>;
}

// ─── Singleton SES Client ─────────────────────────────────────────────────────

const sesClient = new SESClient({
  region: process.env['AWS_REGION'] ?? 'ap-south-1',
});

// ─── Implementation ───────────────────────────────────────────────────────────

class SesService implements ISesService {
  constructor(private readonly config: SesConfig) {}

  async sendEmail(params: SendEmailParams): Promise<Result<string>> {
    const source = `${this.config.fromName} <${this.config.fromEmail}>`;

    return tryAsync(async () => {
      const command = new SendEmailCommand({
        Source: source,
        Destination: {
          ToAddresses: [params.to],
        },
        Message: {
          Subject: {
            Data: params.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: params.html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: params.text,
              Charset: 'UTF-8',
            },
          },
        },
        // Configuration set tracks opens/bounces (optional — configure name via env)
        ...(process.env['SES_CONFIGURATION_SET']
          ? { ConfigurationSetName: process.env['SES_CONFIGURATION_SET'] }
          : {}),
      });

      const response = await sesClient.send(command);
      const messageId = response.MessageId ?? 'no-message-id';
      return messageId;
    }, `SesService.sendEmail:${maskEmail(params.to)}`);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createSesService(config: SesConfig): ISesService {
  return new SesService(config);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Masks an email address for safe log output.
 * "john.doe@example.com" → "j***@example.com"
 */
function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return '***@***';
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  return `${local[0] ?? ''}***${domain}`;
}
