import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { User } from './user/user.entity';
import { DatabaseInitService } from './database/database-init.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_DATABASE', 'marketplacedb'),
        entities: [User],
        synchronize: true, // Auto-update database schema when entities change
        autoLoadEntities: true, // Automatically load all entities
        logging: ['error', 'warn', 'schema'], // Log schema changes
        dropSchema: false, // Don't drop existing tables
        migrations: [],
        retryAttempts: 3,
        retryDelay: 3000,
      }),
      inject: [ConfigService],
    }),
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseInitService],
})
export class AppModule {}
