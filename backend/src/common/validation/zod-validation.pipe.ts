import {
  BadRequestException,
  Injectable,
  Logger,
  type PipeTransform,
} from '@nestjs/common';
import type { z } from 'zod';

@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform<
  unknown,
  TOutput
> {
  private readonly logger = new Logger(ZodValidationPipe.name);

  constructor(private readonly schema: z.ZodType<TOutput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    this.logger.warn(
      `Validation failed: ${JSON.stringify(result.error.issues)}`,
    );

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Entrada inválida.',
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
}
