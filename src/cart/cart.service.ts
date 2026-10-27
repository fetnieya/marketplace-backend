import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './cart-item.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ProductService } from '../product/product.service';
import { ProductStatus } from '../product/product.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private cartRepository: Repository<CartItem>,
    private productService: ProductService,
  ) {}

  async findByUserId(userId: number): Promise<CartItem[]> {
    return this.cartRepository.find({
      where: { userId },
      relations: ['product', 'product.images'],
      order: { id: 'ASC' },
    });
  }

  async getCartForUser(userId: number): Promise<{ product: any; quantity: number }[]> {
    const items = await this.findByUserId(userId);
    return items.map((item) => ({
      product: this.serializeProductForCart(item.product),
      quantity: item.quantity,
    }));
  }

  private serializeProductForCart(product: any): any {
    if (!product) return null;
    let image = product.image;
    if (product.images && product.images.length > 0) {
      const first = product.images[0];
      if (first?.data && Buffer.isBuffer(first.data)) {
        image = `data:image/jpeg;base64,${first.data.toString('base64')}`;
      } else if (first?.url) {
        image = first.url;
      }
    }
    return {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      oldPrice: product.oldPrice != null ? Number(product.oldPrice) : null,
      image: image || null,
    };
  }

  async addItem(userId: number, dto: AddToCartDto): Promise<CartItem[]> {
    const product = await this.productService.findOne(dto.productId);
    if (!product || product.status !== ProductStatus.DISPONIBLE || Number(product.quantity) <= 0) {
      throw new ConflictException('Ce produit est indisponible (sold out).');
    }
    let item = await this.cartRepository.findOne({
      where: { userId, productId: dto.productId },
    });
    const requestedQty = Number(dto.quantity) || 1;
    if (requestedQty < 1) {
      throw new BadRequestException('Quantité invalide.');
    }
    if (item) {
      const nextQty = item.quantity + requestedQty;
      if (nextQty > Number(product.quantity)) {
        throw new ConflictException('Stock insuffisant pour la quantité demandée.');
      }
      item.quantity = nextQty;
      await this.cartRepository.save(item);
    } else {
      if (requestedQty > Number(product.quantity)) {
        throw new ConflictException('Stock insuffisant pour la quantité demandée.');
      }
      item = this.cartRepository.create({
        userId,
        productId: dto.productId,
        quantity: requestedQty,
      });
      await this.cartRepository.save(item);
    }
    return this.findByUserId(userId);
  }

  async updateQuantity(
    userId: number,
    productId: number,
    dto: UpdateCartItemDto,
  ): Promise<void> {
    const item = await this.cartRepository.findOne({
      where: { userId, productId },
    });
    if (!item) return;
    const product = await this.productService.findOne(productId);
    if (!product || product.status !== ProductStatus.DISPONIBLE || Number(product.quantity) <= 0) {
      throw new ConflictException('Ce produit est indisponible (sold out).');
    }
    if (dto.quantity < 1) {
      throw new BadRequestException('Quantité invalide.');
    }
    if (dto.quantity > Number(product.quantity)) {
      throw new ConflictException('Stock insuffisant pour la quantité demandée.');
    }
    item.quantity = dto.quantity;
    await this.cartRepository.save(item);
  }

  async removeItem(userId: number, productId: number): Promise<void> {
    await this.cartRepository.delete({ userId, productId });
  }

  async clearCart(userId: number): Promise<void> {
    await this.cartRepository.delete({ userId });
  }
}
