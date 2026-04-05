import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Product } from '../product/product.entity';
import { Category } from '../category/category.entity';
import { Order } from '../order/order.entity';
import { OrderItem } from '../order/order-item.entity';
import { SellerFollow } from '../seller-follow/seller-follow.entity';
import { ForecastModule } from '../forecast/forecast.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Product,
      Category,
      Order,
      OrderItem,
      SellerFollow,
    ]),
    ForecastModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
