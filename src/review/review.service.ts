import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
  ) {}

  /** Liste tous les avis (admin) avec auteur, produit et vendeur du produit */
  async findAllForAdmin(): Promise<any[]> {
    const rows = await this.reviewRepository.find({
      relations: ['user', 'product', 'product.seller'],
      order: { createdAt: 'DESC' },
      take: 500,
    });
    return rows.map((r) => this.serializeReviewAdmin(r));
  }

  async removeById(id: number): Promise<void> {
    const res = await this.reviewRepository.delete(id);
    if (!res.affected) {
      throw new NotFoundException('Avis introuvable');
    }
  }

  async findByProductId(productId: number): Promise<Review[]> {
    const reviews = await this.reviewRepository.find({
      where: { productId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return reviews.map((r) => this.serializeReview(r));
  }

  async getStats(productId: number): Promise<{ average: number; count: number }> {
    const reviews = await this.reviewRepository.find({
      where: { productId },
      select: ['rating'],
    });
    const count = reviews.length;
    if (count === 0) {
      return { average: 0, count: 0 };
    }
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = Math.round((sum / count) * 10) / 10; // 1 decimal
    return { average, count };
  }

  /**
   * Avis du vendeur, regroupés par produit (le vendeur ne voit que ses produits).
   */
  async findGroupedByProductForSeller(sellerId: number): Promise<{
    products: Array<{
      productId: number;
      productName: string;
      productImage: string | null;
      stats: { average: number; count: number };
      reviews: any[];
    }>;
    stats: { average: number; count: number };
  }> {
    const rows = await this.reviewRepository
      .createQueryBuilder('review')
      .innerJoinAndSelect('review.product', 'product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('review.user', 'user')
      .where('product.sellerId = :sellerId', { sellerId })
      .orderBy('review.createdAt', 'DESC')
      .getMany();

    const map = new Map<
      number,
      {
        productId: number;
        productName: string;
        productImage: string | null;
        reviews: any[];
        ratings: number[];
      }
    >();

    for (const r of rows) {
      const p = r.product as { id: number; name?: string };
      const pid = p.id;
      if (!map.has(pid)) {
        map.set(pid, {
          productId: pid,
          productName: p.name || '—',
          productImage: this.resolveProductThumbnail(r.product as any),
          reviews: [],
          ratings: [],
        });
      }
      const g = map.get(pid)!;
      g.reviews.push(this.serializeReview(r));
      g.ratings.push(r.rating);
    }

    const products = Array.from(map.values()).map((g) => {
      const count = g.ratings.length;
      const sum = g.ratings.reduce((a, b) => a + b, 0);
      const average =
        count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
      return {
        productId: g.productId,
        productName: g.productName,
        productImage: g.productImage,
        stats: { average, count },
        reviews: g.reviews,
      };
    });

    products.sort((a, b) => {
      const ta = a.reviews[0]?.createdAt
        ? new Date(a.reviews[0].createdAt).getTime()
        : 0;
      const tb = b.reviews[0]?.createdAt
        ? new Date(b.reviews[0].createdAt).getTime()
        : 0;
      return tb - ta;
    });

    const stats = await this.getStatsForSeller(sellerId);
    return { products, stats };
  }

  async findBySellerId(sellerId: number): Promise<{
    reviews: any[];
    stats: { average: number; count: number };
  }> {
    const rows = await this.reviewRepository
      .createQueryBuilder('review')
      .innerJoinAndSelect('review.product', 'product')
      .leftJoinAndSelect('review.user', 'user')
      .where('product.sellerId = :sellerId', { sellerId })
      .orderBy('review.createdAt', 'DESC')
      .take(150)
      .getMany();

    const reviews = rows.map((r) => {
      const serialized = this.serializeReview(r);
      const p = r.product as { name?: string } | undefined;
      return {
        ...serialized,
        productName: p?.name,
      };
    });

    const stats = await this.getStatsForSeller(sellerId);
    return { reviews, stats };
  }

  private async getStatsForSeller(
    sellerId: number,
  ): Promise<{ average: number; count: number }> {
    const raw = await this.reviewRepository
      .createQueryBuilder('review')
      .innerJoin('review.product', 'product')
      .where('product.sellerId = :sellerId', { sellerId })
      .select('AVG(review.rating)', 'avg')
      .addSelect('COUNT(review.id)', 'cnt')
      .getRawOne<{ avg: string | null; cnt: string }>();

    const count = raw?.cnt ? parseInt(String(raw.cnt), 10) : 0;
    if (!count) {
      return { average: 0, count: 0 };
    }
    const avg = raw?.avg != null ? parseFloat(String(raw.avg)) : 0;
    const average = Math.round(avg * 10) / 10;
    return { average, count };
  }

  async create(userId: number, dto: CreateReviewDto): Promise<Review> {
    const review = this.reviewRepository.create({
      ...dto,
      userId,
    });
    return this.reviewRepository.save(review);
  }

  /** Première image affichable du produit (galerie ou colonne `image`) */
  private resolveProductThumbnail(product: any): string | null {
    if (!product) {
      return null;
    }
    const imgs = product.images;
    if (imgs && Array.isArray(imgs) && imgs.length > 0) {
      const sorted = [...imgs].sort(
        (a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0),
      );
      for (const image of sorted) {
        if (image?.data && Buffer.isBuffer(image.data)) {
          return `data:image/jpeg;base64,${image.data.toString('base64')}`;
        }
        if (typeof image?.url === 'string' && image.url) {
          return image.url;
        }
      }
    }
    const main = product.image;
    if (typeof main === 'string' && main.length > 0) {
      if (main.startsWith('data:') || main.startsWith('http')) {
        return main;
      }
      return `data:image/jpeg;base64,${main}`;
    }
    return null;
  }

  async markHelpful(reviewId: number): Promise<{ helpfulCount: number }> {
    const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    review.helpfulCount = (review.helpfulCount || 0) + 1;
    await this.reviewRepository.save(review);
    return { helpfulCount: review.helpfulCount };
  }

  private serializeReviewAdmin(review: Review): any {
    const u = review.user as any;
    const p = review.product as any;
    const seller = p?.seller as
      | { id?: number; firstName?: string; lastName?: string; email?: string }
      | undefined;
    const sellerId = p?.sellerId ?? seller?.id ?? 0;
    return {
      id: review.id,
      productId: review.productId,
      productName: p?.name || '—',
      rating: review.rating,
      comment: review.comment,
      productColor: review.productColor,
      productSize: review.productSize,
      verifiedPurchase: review.verifiedPurchase,
      createdAt: review.createdAt,
      userId: review.userId,
      userEmail: u?.email || '',
      userName: u
        ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email
        : 'Anonyme',
      sellerId,
      sellerName: seller
        ? `${seller.firstName || ''} ${seller.lastName || ''}`.trim() ||
          seller.email ||
          '—'
        : '—',
      sellerEmail: seller?.email || '',
    };
  }

  private serializeReview(review: Review): any {
    const u = review.user as any;
    return {
      id: review.id,
      productId: review.productId,
      rating: review.rating,
      comment: review.comment,
      productColor: review.productColor,
      productSize: review.productSize,
      verifiedPurchase: review.verifiedPurchase,
      helpfulCount: review.helpfulCount ?? 0,
      createdAt: review.createdAt,
      userName: u ? `${u.firstName || ''} ${(u.lastName || '').charAt(0)}.`.trim() : 'Anonyme',
      userInitials: u
        ? [u.firstName, u.lastName]
            .filter(Boolean)
            .map((s) => (s || '').charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2)
        : '?',
    };
  }
}
