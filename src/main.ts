import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Désactiver le body parser par défaut pour le configurer manuellement
  });

  // Augmenter la limite de taille du JSON body (défaut: 100kb, maintenant: 10MB)
  // Pour accepter les images en base64 dans les requêtes PUT/POST
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  // Enable CORS for frontend connection
  app.enableCors({
    origin: [
      'http://localhost:8080',
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  });

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
void bootstrap();
