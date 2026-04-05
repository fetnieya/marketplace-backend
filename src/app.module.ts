import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { ProductModule } from './product/product.module';
import { ReviewModule } from './review/review.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';
import { UploadModule } from './upload/upload.module';
import { MailModule } from './mail/mail.module';
import { SellerFollowModule } from './seller-follow/seller-follow.module';
import { ChatModule } from './chat/chat.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { User } from './user/user.entity';
import { Category } from './category/category.entity';
import { Product } from './product/product.entity';
import { Image } from './image/image.entity';
import { ResetCode } from './auth/entities/reset-code.entity';
import { Review } from './review/review.entity';
import { CartItem } from './cart/cart-item.entity';
import { Order } from './order/order.entity';
import { OrderItem } from './order/order-item.entity';
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
        entities: [User, Category, Product, Image, ResetCode, Review, CartItem],
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
    CategoryModule,
    ProductModule,
    ReviewModule,
    CartModule,
    OrderModule,
    UploadModule,
    MailModule,
    SellerFollowModule,
    ChatModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseInitService],
})
export class AppModule {}
