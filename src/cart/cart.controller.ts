import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getCart(@Request() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.cartService.getCartForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('items')
  async addItem(@Request() req: any, @Body() dto: AddToCartDto) {
    const userId = req.user?.sub ?? req.user?.id;
    await this.cartService.addItem(userId, dto);
    return this.cartService.getCartForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('items/:productId')
  async updateItem(
    @Request() req: any,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const userId = req.user?.sub ?? req.user?.id;
    await this.cartService.updateQuantity(userId, +productId, dto);
    return this.cartService.getCartForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('items/:productId')
  async removeItem(@Request() req: any, @Param('productId') productId: string) {
    const userId = req.user?.sub ?? req.user?.id;
    await this.cartService.removeItem(userId, +productId);
    return this.cartService.getCartForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  async clearCart(@Request() req: any) {
    const userId = req.user?.sub ?? req.user?.id;
    await this.cartService.clearCart(userId);
    return [];
  }
}
