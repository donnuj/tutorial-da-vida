import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as Record<string, unknown>)
        : 'Erro interno do servidor';

    const isProd = process.env.NODE_ENV === 'production';

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}`,
        isProd ? undefined : (exception instanceof Error ? exception.stack : String(exception)),
      );
    } else {
      this.logger.warn(`${req.method} ${req.url} → ${status}`);
    }

    res.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
      message: isProd && status >= 500 ? 'Erro interno do servidor' : message,
    });
  }
}
