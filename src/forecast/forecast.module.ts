import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/order.entity';
import { OrderItem } from '../order/order-item.entity';
import { ForecastService } from './forecast.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem])],
  providers: [ForecastService],
  exports: [ForecastService],
})
export class ForecastModule {}
