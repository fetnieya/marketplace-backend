import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './review.entity';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { OrderItem } from '../order/order-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Review, OrderItem])],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
