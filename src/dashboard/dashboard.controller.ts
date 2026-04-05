import {
  Controller,
  Get,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { UserRole } from '../user/user.entity';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get('admin')
  async admin(@Request() req: { user: { id: number; role: UserRole } }) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }
    return this.dashboardService.getAdminStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('seller')
  async seller(@Request() req: { user: { id: number; role: UserRole } }) {
    if (req.user.role !== UserRole.SELLER) {
      throw new ForbiddenException('Accès réservé aux vendeurs');
    }
    return this.dashboardService.getSellerStats(req.user.id);
  }
}
