import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(
    z.object({ name: z.string().min(3) }).strict(),
  );

  it('retorna dados validados', () => {
    expect(pipe.transform({ name: 'Lola' })).toEqual({ name: 'Lola' });
  });

  it('retorna erro 400 padronizado sem ecoar o input', () => {
    try {
      pipe.transform({ name: 'x', secret: 'não deve aparecer' });
      throw new Error('A validação deveria falhar.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);
      if (error instanceof BadRequestException) {
        const response = error.getResponse();
        expect(response).toEqual(
          expect.objectContaining({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Entrada inválida.',
          }),
        );
        expect(JSON.stringify(response)).not.toContain('não deve aparecer');
      }
    }
  });
});
