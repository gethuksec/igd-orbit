import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Bootstrap the NestJS application
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // IGDERP-136 detail round: serve uploaded service photos (volume-backed ./uploads)
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // Global ValidationPipe with transform enabled
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: false, // Don't throw error for non-whitelisted properties
      // Join multiple validation messages into one readable string instead of
      // an array (React renders arrays concatenated — "requiredmust be a string")
      exceptionFactory: (errors) => {
        // Flatten nested (children) errors too — otherwise failures inside
        // parts[]/completenessItems[] surface as a bare "Validation failed".
        const flat: string[] = [];
        const walk = (list: any[], prefix: string) => {
          for (const e of list) {
            const path = prefix ? `${prefix}.${e.property}` : String(e.property);
            for (const msg of Object.values(e.constraints || {})) flat.push(`${path}: ${msg}`);
            if (e.children?.length) walk(e.children, path);
          }
        };
        walk(errors as any[], '');
        const messages = flat.join(', ');
        return new BadRequestException(messages || 'Validation failed');
      },
    }),
  );

  // Global exception filter for better error logging
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}/api/v1`);
}

bootstrap().catch((error) => {
  console.error('❌ Error starting application:', error);
  process.exit(1);
});
