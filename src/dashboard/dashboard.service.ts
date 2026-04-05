import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../user/user.entity';
import { Product } from '../product/product.entity';
import { Category } from '../category/category.entity';
import { Order } from '../order/order.entity';
import { OrderItem } from '../order/order-item.entity';
import { SellerFollow } from '../seller-follow/seller-follow.entity';
import { ForecastService } from '../forecast/forecast.service';

const MONTHS_BACK = 6;

function monthsAgoDate(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - MONTHS_BACK);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(SellerFollow)
    private readonly sellerFollowRepository: Repository<SellerFollow>,
    private readonly forecastService: ForecastService,
  ) {}

  async getAdminStats() {
    const from = monthsAgoDate();

    const [clients, sellers, products, categories, orders] = await Promise.all([
      this.userRepository.count({ where: { role: UserRole.CLIENT } }),
      this.userRepository.count({ where: { role: UserRole.SELLER } }),
      this.productRepository.count(),
      this.categoryRepository.count(),
      this.orderRepository.count(),
    ]);

    const revenueRow = await this.orderRepository
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total), 0)', 'sum')
      .getRawOne();
    const revenue = Number(revenueRow?.sum ?? 0);

    const monthlyRaw = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.createdAt >= :from', { from })
      .select("DATE_FORMAT(o.createdAt, '%Y-%m')", 'month')
      .addSelect('COUNT(o.id)', 'orders')
      .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    const byStatusRaw = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(o.id)', 'count')
      .groupBy('o.status')
      .getRawMany();

    const prediction =
      await this.forecastService.getAdminPredictionPayload();

    return {
      clients,
      sellers,
      products,
      categories,
      orders,
      revenue,
      monthly: monthlyRaw.map((r) => ({
        month: r.month,
        orders: Number(r.orders ?? 0),
        revenue: Number(r.revenue ?? 0),
      })),
      ordersByStatus: byStatusRaw.map((r) => ({
        status: r.status,
        count: Number(r.count ?? 0),
      })),
      prediction,
    };
  }

  async getSellerStats(sellerId: number) {
    const from = monthsAgoDate();

    const [products, followers] = await Promise.all([
      this.productRepository.count({ where: { sellerId } }),
      this.sellerFollowRepository.count({ where: { sellerId } }),
    ]);

    const ordersRow = await this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.product', 'p')
      .where('p.sellerId = :sellerId', { sellerId })
      .select('COUNT(DISTINCT oi.orderId)', 'cnt')
      .getRawOne();

    const revenueRow = await this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.product', 'p')
      .where('p.sellerId = :sellerId', { sellerId })
      .select(
        'COALESCE(SUM(oi.quantity * oi.priceAtPurchase), 0)',
        'sum',
      )
      .getRawOne();

    const monthlyRaw = await this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .innerJoin('oi.product', 'p')
      .where('p.sellerId = :sellerId', { sellerId })
      .andWhere('o.createdAt >= :from', { from })
      .select("DATE_FORMAT(o.createdAt, '%Y-%m')", 'month')
      .addSelect(
        'COALESCE(SUM(oi.quantity * oi.priceAtPurchase), 0)',
        'revenue',
      )
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    const prediction =
      await this.forecastService.getSellerPredictionPayload(sellerId);

    return {
      products,
      followers,
      orders: Number(ordersRow?.cnt ?? 0),
      revenue: Number(revenueRow?.sum ?? 0),
      monthly: monthlyRaw.map((r) => ({
        month: r.month,
        revenue: Number(r.revenue ?? 0),
      })),
      prediction,
    };
  }
}
