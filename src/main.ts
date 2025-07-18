// src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'; // Import Swagger modules
import { ConfigService } from '@nestjs/config';

// Define a function to validate critical environment variables
async function validateEnvironmentVariables(configService: ConfigService, logger: Logger) {
  // List of critical environment variables that must be present and non-empty
  const requiredEnvVars = [
    'PORT',
    'CORS_ORIGIN',
    'ELASTICSEARCH_URL',
    'ELASTICSEARCH_API_KEY',
  ];

  const missingVars: string[] = [];

  for (const varName of requiredEnvVars) {
    const value = configService.get<string>(varName);
    // Check if the value is null, undefined, or an empty string after trimming whitespace
    if (!value || value.trim() === '') {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    const errorMessage = `CRITICAL ERROR: The following environment variables are missing or empty: [${missingVars.join(', ')}]. Application cannot start without them.`;
    logger.error(errorMessage);
    // Throw an error to prevent the application from listening and stop execution
    throw new Error(errorMessage);
  }
}

async function bootstrap() {
  const logger = new Logger('main.ts');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Call the function to validate the environment variables
  await validateEnvironmentVariables(configService, logger);

  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  
  // Check for null, undefined, or empty string
  if (!corsOrigin || corsOrigin.trim() === '') {
    const errorMessage = 'CRITICAL ERROR: The [CORS_ORIGIN] environment variable is missing or empty. Application cannot start without it.';
    logger.error(errorMessage);
    // Throw an error to prevent the application from listening and stop execution
    throw new Error(errorMessage);
  }
  
  // Enable CORS for the frontend
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Apply ValidationPipe globally
  app.useGlobalPipes(new ValidationPipe({
    transform: true, // Automatically transform payloads to DTO instances
    whitelist: true, // Remove properties not defined in DTO
    forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
  }));

  // Setup Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('demo-store-order-service API')
    .setDescription('API for managing orders')
    .setVersion('1.0')
    .addTag('orders') // Tag for your orders endpoints
    //.addTag('categories') // Tag for your categories endpoints (from .NET, but good for docs)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // Access Swagger UI at /api

  await app.listen(3000); // NestJS app will run on port 3000
  console.log(`NestJS application is running on: ${await app.getUrl()}`);
}
bootstrap();
