// =============================================================================
// src/main.ts
// BlockLand Zimbabwe — NestJS Application Bootstrap
// =============================================================================
//
// PURPOSE: The entry point of the NestJS application. Bootstraps the app,
//          applies global middleware (Helmet, CORS, ValidationPipe, Throttler),
//          and starts listening on the configured port.
//
// SECURITY MIDDLEWARE APPLIED HERE:
//   Helmet     — sets secure HTTP response headers (XSS, clickjacking protection)
//   CORS       — restricts API calls to the frontend origin only
//   Throttler  — rate limiting (applied via ThrottlerGuard in AppModule)
//   ValidationPipe — globally applies class-validator to all incoming DTOs
//
// WHY GLOBAL VALIDATION PIPE?
//   Applying ValidationPipe globally means every route body is automatically
//   validated against its DTO class without decorating each handler manually.
//   whitelist: true strips any properties not declared in the DTO.
//   forbidNonWhitelisted: true rejects requests with unexpected properties.
//   transform: true converts plain objects to DTO class instances automatically.
// =============================================================================

import { NestFactory }           from '@nestjs/core';
import { ValidationPipe }        from '@nestjs/common';
import { ConfigService }         from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet                    from 'helmet';
import { AppModule }             from './app.module';
import { HttpExceptionFilter }   from './common/filters/http-exception.filter';
import { ResponseInterceptor }   from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Suppress verbose startup logs in production
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'error', 'warn', 'debug'],
  });

  const configService = app.get(ConfigService);

  // ---------------------------------------------------------------------------
  // GLOBAL PREFIX
  // All API routes are prefixed with /api — e.g. GET /api/properties
  // This separates the API from any static file serving on the same host.
  // ---------------------------------------------------------------------------
  // P5 update: versioned prefix /api/v1 per the API spec
  app.setGlobalPrefix('api/v1');

  // ---------------------------------------------------------------------------
  // HELMET — HTTP Security Headers
  // Sets headers like: X-Content-Type-Options, X-Frame-Options, HSTS,
  // Content-Security-Policy, X-XSS-Protection, etc.
  // Must be applied BEFORE any routes are registered.
  // ---------------------------------------------------------------------------
  app.use(helmet());

  // ---------------------------------------------------------------------------
  // CORS — Cross-Origin Resource Sharing
  // Only allows requests from the Next.js frontend origin.
  // Credentials: true allows cookies and Authorization headers cross-origin.
  // ---------------------------------------------------------------------------
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  app.enableCors({
    origin: frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
    credentials: true,
  });

  // ---------------------------------------------------------------------------
  // GLOBAL VALIDATION PIPE
  // Applied to every incoming request body and query parameter.
  //   whitelist: true            — strips unknown properties silently
  //   forbidNonWhitelisted: true — rejects requests with unexpected fields
  //   transform: true            — converts plain objects to DTO class instances
  //   transformOptions.enableImplicitConversion — converts query string numbers
  // ---------------------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ---------------------------------------------------------------------------
  // GLOBAL EXCEPTION FILTER
  // Catches all unhandled exceptions and formats them as consistent JSON errors:
  //   { statusCode: 400, message: '...', error: 'Bad Request', timestamp: '...' }
  // ---------------------------------------------------------------------------
  app.useGlobalFilters(new HttpExceptionFilter());

  // ---------------------------------------------------------------------------
  // GLOBAL RESPONSE INTERCEPTOR
  // Wraps all successful responses in a standard envelope:
  //   { success: true, data: {...}, timestamp: '...' }
  // ---------------------------------------------------------------------------
  app.useGlobalInterceptors(new ResponseInterceptor());

  // ---------------------------------------------------------------------------
  // SWAGGER API DOCUMENTATION
  // Available at /api/docs in development only.
  // In production: protect or disable the docs endpoint.
  // ---------------------------------------------------------------------------
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BlockLand Zimbabwe API')
      .setDescription(
        'REST API for the BlockLand blockchain-based land administration system. ' +
        'Built with NestJS + TypeORM + Stacks Blockchain.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth',         'Authentication & user management')
      .addTag('properties',   'Land property registration & management')
      .addTag('transfers',    'Ownership transfer workflow')
      .addTag('disputes',     'Dispute management')
      .addTag('verification', 'Public property verification (no auth required)')
      .addTag('admin',        'Admin & registrar management')
      .addTag('documents',    'Document upload & retrieval')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`📚 Swagger docs: http://localhost:${configService.get('PORT', 3001)}/api/docs`);
  }

  // ---------------------------------------------------------------------------
  // START LISTENING
  // ---------------------------------------------------------------------------
  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`🚀 BlockLand API running on: http://localhost:${port}/api`);
}

bootstrap();
