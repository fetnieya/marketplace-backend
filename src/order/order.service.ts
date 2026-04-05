import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CartService } from '../cart/cart.service';
import { Product } from '../product/product.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    private cartService: CartService,
  ) {}

  /** Même logique que ProductService.serializeProduct pour l’aperçu (data URL depuis BLOB). */
  private resolveProductImageUrl(product?: Product | null): string | null {
    if (!product) return null;
    const imgs = [...(product.images ?? [])].sort(
      (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
    );
    for (const img of imgs) {
      const raw = (img as { data?: Buffer }).data;
      if (raw && Buffer.isBuffer(raw)) {
        return `data:image/jpeg;base64,${raw.toString('base64')}`;
      }
    }
    const main = product.image;
    if (typeof main === 'string' && main.trim().length > 0) {
      return main.trim();
    }
    return null;
  }

  async create(userId: number, dto: CreateOrderDto): Promise<Order> {
    const total = dto.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const order = this.orderRepository.create({
      userId,
      total,
      status: 'pending',
      shippingAddress: dto.shippingAddress,
      paymentMethod: dto.paymentMethod,
      paymentMeta:
        dto.paymentMethod === 'card' && dto.paymentMeta
          ? {
              cardLast4: dto.paymentMeta.cardLast4,
              cardHolder: dto.paymentMeta.cardHolder,
            }
          : undefined,
    });
    const saved = await this.orderRepository.save(order);
    for (const item of dto.items) {
      await this.orderItemRepository.save(
        this.orderItemRepository.create({
          orderId: saved.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase: item.price,
        }),
      );
    }
    await this.cartService.clearCart(userId);
    const foundOrder = await this.orderRepository.findOne({
      where: { id: saved.id },
      relations: ['items'],
    });
    if (!foundOrder) {
      throw new Error('Order was not found after create');
    }
    return foundOrder;
  }

  async findForBuyer(userId: number) {
    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['items', 'items.product', 'items.product.images'],
      order: { createdAt: 'DESC' },
    });
    return orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
      paymentMeta: order.paymentMeta,
      shippingAddress: order.shippingAddress,
      items: (order.items ?? []).map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        priceAtPurchase: Number(i.priceAtPurchase),
        productName: i.product?.name ?? 'Produit',
        productImage: this.resolveProductImageUrl(i.product ?? null),
      })),
    }));
  }

  async findForSeller(sellerId: number) {
    const lineItems = await this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.product', 'p')
      .where('p.sellerId = :sellerId', { sellerId })
      .select(['oi.orderId'])
      .getMany();
    const ids = [
      ...new Set(
        lineItems
          .map((i) => Number(i.orderId))
          .filter((id) => !Number.isNaN(id)),
      ),
    ];
    if (!ids.length) {
      return [];
    }
    const orders = await this.orderRepository.find({
      where: { id: In(ids) },
      relations: ['items', 'items.product', 'user'],
      order: { createdAt: 'DESC' },
    });
    return orders.map((order) => {
      const myItems =
        order.items?.filter((i) => i.product?.sellerId === sellerId) ?? [];
      const sellerSubtotal = myItems.reduce(
        (sum, i) =>
          sum + Number(i.priceAtPurchase) * Number(i.quantity),
        0,
      );
      const u = order.user;
      return {
        id: order.id,
        createdAt: order.createdAt,
        status: order.status,
        total: Number(order.total),
        paymentMethod: order.paymentMethod,
        paymentMeta: order.paymentMeta,
        shippingAddress: order.shippingAddress,
        client: u
          ? {
              id: u.id,
              firstName: u.firstName,
              lastName: u.lastName,
              email: u.email,
              phone: u.phone,
            }
          : null,
        myItems: myItems.map((i) => ({
          id: i.id,
          productId: i.productId,
          quantity: i.quantity,
          priceAtPurchase: Number(i.priceAtPurchase),
          productName: i.product?.name ?? 'Produit',
        })),
        sellerSubtotal,
      };
    });
  }

  async updateStatusBySeller(
    orderId: number,
    sellerId: number,
    status: string,
  ): Promise<{ id: number; status: string }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product'],
    });
    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }
    const ownsLine = order.items?.some(
      (i) => i.product?.sellerId === sellerId,
    );
    if (!ownsLine) {
      throw new ForbiddenException(
        'Cette commande ne contient aucun de vos produits',
      );
    }
    order.status = status;
    await this.orderRepository.save(order);
    return { id: order.id, status: order.status };
  }
}
