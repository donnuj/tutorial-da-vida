import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());
  app.use(
    helmet({
      crossOriginOpenerPolicy: false,
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  app.setGlobalPrefix('api/v1');
  app.useBodyParser('json', { limit: '256kb' });
  app.enableCors({ origin: config.getOrThrow<string[]>('CORS_ORIGINS'), credentials: true });

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  logger.log(`Tutorial da Vida API rodando em http://localhost:${port}/api/v1`);
}
void bootstrap();
