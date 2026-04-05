import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../product/product.entity';
import { ForecastModule } from '../forecast/forecast.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { EmbeddingService } from './embedding.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), ForecastModule],
  controllers: [ChatController],
  providers: [ChatService, EmbeddingService],
  exports: [ChatService, EmbeddingService],
})
export class ChatModule {}
