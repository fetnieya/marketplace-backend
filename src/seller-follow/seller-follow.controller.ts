import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { SellerFollowService } from './seller-follow.service';
import { FollowSellerDto } from './dto/follow-seller.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../user/user.entity';

@Controller('followers')
export class SellerFollowController {
  constructor(private readonly sellerFollowService: SellerFollowService) {}

  private userFromReq(req: any): { id: number; role: UserRole } {
    const u = req.user;
    const id = u?.id ?? u?.sub;
    return { id, role: u?.role };
  }

  @UseGuards(JwtAuthGuard)
  @Get('following')
  async listFollowing(@Request() req: any) {
    const { id, role } = this.userFromReq(req);
    if (role !== UserRole.CLIENT) {
      throw new ForbiddenException('Réservé aux clients');
    }
    return this.sellerFollowService.listFollowingSellers(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status/:sellerId')
  async followStatus(@Request() req: any, @Param('sellerId') sellerId: string) {
    const { id, role } = this.userFromReq(req);
    const sid = parseInt(sellerId, 10);
    if (Number.isNaN(sid)) {
      return { following: false };
    }
    if (role !== UserRole.CLIENT) {
      return { following: false };
    }
    const following = await this.sellerFollowService.isFollowing(id, sid);
    return { following };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async follow(@Request() req: any, @Body() dto: FollowSellerDto) {
    const { id, role } = this.userFromReq(req);
    if (role !== UserRole.CLIENT) {
      throw new ForbiddenException('Seuls les clients peuvent suivre un vendeur');
    }
    return this.sellerFollowService.follow(id, dto.sellerId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('by-seller/:sellerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollowBySeller(
    @Request() req: any,
    @Param('sellerId') sellerId: string,
  ) {
    const { id, role } = this.userFromReq(req);
    if (role !== UserRole.CLIENT) {
      throw new ForbiddenException('Seuls les clients peuvent gérer leurs abonnements');
    }
    const sid = parseInt(sellerId, 10);
    if (Number.isNaN(sid)) {
      return;
    }
    await this.sellerFollowService.unfollowBySellerId(id, sid);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async listMyFollowers(@Request() req: any) {
    const { id, role } = this.userFromReq(req);
    if (role !== UserRole.SELLER) {
      throw new ForbiddenException('Réservé aux vendeurs');
    }
    return this.sellerFollowService.listFollowersForSeller(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req: any, @Param('id') id: string) {
    const { id: userId, role } = this.userFromReq(req);
    const followId = parseInt(id, 10);
    if (Number.isNaN(followId)) {
      throw new ForbiddenException('Identifiant invalide');
    }
    await this.sellerFollowService.remove(followId, userId, role);
  }
}
