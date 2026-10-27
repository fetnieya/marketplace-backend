import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../user/user.entity';
import { CategoryRequestService } from './category-request.service';
import { CreateCategoryRequestDto } from './dto/create-category-request.dto';

@Controller('category-requests')
export class CategoryRequestController {
  constructor(
    private readonly categoryRequestService: CategoryRequestService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: { user: { id?: number; sub?: number; role?: UserRole } },
    @Body() dto: CreateCategoryRequestDto,
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    if (userId == null) {
      throw new ForbiddenException('Utilisateur non identifié');
    }
    if (req.user?.role !== UserRole.SELLER) {
      throw new ForbiddenException('Seuls les vendeurs peuvent demander une catégorie');
    }
    return this.categoryRequestService.create(userId, dto);
  }
}
