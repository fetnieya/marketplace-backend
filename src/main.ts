import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
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

  // CORS: autoriser tout localhost / 127.0.0.1 (ports dev Vue, etc.)
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        return callback(null, true);
      }
      try {
        const u = new URL(origin);
        const ok =
          u.hostname === 'localhost' ||
          u.hostname === '127.0.0.1' ||
          u.hostname === '::1';
        return callback(null, ok);
      } catch {
        return callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  });

  // Enable global validation avec messages d'erreur en français
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          const constraints = error.constraints || {};
          const property = error.property;

          // Traductions des champs
          const fieldNames: { [key: string]: string } = {
            firstName: 'Le prénom',
            lastName: 'Le nom',
            email: "L'email",
            phone: 'Le téléphone',
            cin: 'Le CIN',
            password: 'Le mot de passe',
            dateOfBirth: 'La date de naissance',
            role: 'Le rôle',
          };

          const fieldName = fieldNames[property] || property;

          // Traduire les messages d'erreur
          const errorMessages: string[] = [];
          Object.values(constraints).forEach((message: string) => {
            if (
              message.includes('should not be empty') ||
              message.includes('isNotEmpty')
            ) {
              errorMessages.push(`${fieldName} ne doit pas être vide`);
            } else if (
              message.includes('must be an email') ||
              message.includes('isEmail')
            ) {
              errorMessages.push(`${fieldName} doit être un email valide`);
            } else if (message.includes('must be longer than or equal to')) {
              const match = message.match(
                /must be longer than or equal to (\d+) characters/,
              );
              const minLength = match ? match[1] : '6';
              errorMessages.push(
                `${fieldName} doit contenir au moins ${minLength} caractères`,
              );
            } else if (
              message.includes('must be a string') ||
              message.includes('isString')
            ) {
              errorMessages.push(
                `${fieldName} doit être une chaîne de caractères`,
              );
            } else if (message.includes('must be a date string')) {
              errorMessages.push(`${fieldName} doit être une date valide`);
            } else {
              // Utiliser le message personnalisé s'il existe
              errorMessages.push(message);
            }
          });

          return errorMessages.length > 0
            ? errorMessages[0]
            : `${fieldName} est invalide`;
        });

        return new BadRequestException(messages);
      },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
void bootstrap();
