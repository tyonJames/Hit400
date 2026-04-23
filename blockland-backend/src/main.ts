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
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'error', 'warn', 'debug'],
  });

  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());

  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  const isDev = configService.get<string>('NODE_ENV') !== 'production';
  app.enableCors({
    origin: isDev
      ? (origin, cb) => cb(null, !origin || /^http:\/\/localhost(:\d+)?$/.test(origin))
      : frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BlockLand Zimbabwe API')
      .setDescription('REST API for the BlockLand blockchain-based land administration system.')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
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
    console.log(`Swagger docs: http://localhost:${configService.get('PORT', 3001)}/api/docs`);
  }

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`BlockLand API running on: http://localhost:${port}/api/v1`);
}

bootstrap();
