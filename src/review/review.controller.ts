import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Delete,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../user/user.entity';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  private assertAdmin(req: { user?: { role?: UserRole } }) {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  async adminList(@Request() req: { user?: { role?: UserRole } }) {
    this.assertAdmin(req);
    return this.reviewService.findAllForAdmin();
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/:id')
  async adminRemove(
    @Request() req: { user?: { role?: UserRole } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertAdmin(req);
    await this.reviewService.removeById(id);
    return { success: true };
  }

  private assertSeller(req: { user?: { role?: UserRole } }) {
    if (req.user?.role !== UserRole.SELLER) {
      throw new ForbiddenException('Accès réservé aux vendeurs');
    }
  }

  /** Connecté vendeur : avis regroupés par produit (ses annonces uniquement) */
  @UseGuards(JwtAuthGuard)
  @Get('seller/me/by-product')
  async sellerReviewsByProduct(@Request() req: { user?: { id: number; role?: UserRole } }) {
    this.assertSeller(req);
    const sellerId = req.user!.id;
    return this.reviewService.findGroupedByProductForSeller(sellerId);
  }

  @Get('seller/:sellerId')
  async findBySeller(@Param('sellerId') sellerId: string) {
    const id = parseInt(sellerId, 10);
    if (Number.isNaN(id)) {
      return { reviews: [], stats: { average: 0, count: 0 } };
    }
    return this.reviewService.findBySellerId(id);
  }

  @Get('product/:productId')
  async findByProduct(@Param('productId') productId: string) {
    const id = parseInt(productId, 10);
    const reviews = await this.reviewService.findByProductId(id);
    const stats = await this.reviewService.getStats(id);
    return { reviews, stats };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() dto: CreateReviewDto) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.reviewService.create(userId, dto);
  }

  @Post(':id/helpful')
  async markHelpful(@Param('id') id: string) {
    const reviewId = parseInt(id, 10);
    return this.reviewService.markHelpful(reviewId);
  }
}
