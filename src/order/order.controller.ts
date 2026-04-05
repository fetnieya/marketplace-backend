import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../user/user.entity';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() dto: CreateOrderDto) {
    const userId = req.user?.sub ?? req.user?.id;
    return this.orderService.create(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async listMine(@Request() req: any) {
    const user = req.user;
    if (user.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Accès réservé aux clients');
    }
    return this.orderService.findForBuyer(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('seller')
  async listForSeller(@Request() req: any) {
    const user = req.user;
    if (user.role !== UserRole.SELLER) {
      throw new ForbiddenException('Accès réservé aux vendeurs');
    }
    return this.orderService.findForSeller(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  async updateStatus(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const user = req.user;
    if (user.role !== UserRole.SELLER) {
      throw new ForbiddenException('Accès réservé aux vendeurs');
    }
    return this.orderService.updateStatusBySeller(id, user.id, dto.status);
  }
}
