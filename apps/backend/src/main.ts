import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOriginConfig = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000,http://localhost:3001',
  );
  const allowedOrigins = corsOriginConfig.split(',').map((origin) => origin.trim());

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend iniciado en http://localhost:${port}/api`);
}

bootstrap();
