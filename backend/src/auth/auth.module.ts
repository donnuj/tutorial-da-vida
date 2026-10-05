import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthAttemptLimiter } from './auth-attempt-limiter';
import { EmailService } from './email.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN') as NonNullable<
            JwtModuleOptions['signOptions']
          >['expiresIn'],
          issuer: config.getOrThrow<string>('JWT_ISSUER'),
          audience: config.getOrThrow<string>('JWT_AUDIENCE'),
          algorithm: 'HS256',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthAttemptLimiter, EmailService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
