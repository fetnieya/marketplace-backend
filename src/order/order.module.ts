import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { CartModule } from '../cart/cart.module';
import { Product } from '../product/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product]),
    CartModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
