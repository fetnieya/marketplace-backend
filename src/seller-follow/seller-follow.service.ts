import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SellerFollow } from './seller-follow.entity';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/user.entity';

@Injectable()
export class SellerFollowService {
  constructor(
    @InjectRepository(SellerFollow)
    private readonly followRepo: Repository<SellerFollow>,
    private readonly userService: UserService,
  ) {}

  async follow(clientId: number, sellerId: number): Promise<SellerFollow> {
    if (clientId === sellerId) {
      throw new BadRequestException('Vous ne pouvez pas vous suivre vous-même');
    }

    const client = await this.userService.findById(clientId);
    if (!client || client.role !== UserRole.CLIENT) {
      throw new ForbiddenException('Seuls les clients peuvent suivre un vendeur');
    }

    const seller = await this.userService.findById(sellerId);
    if (!seller || seller.role !== UserRole.SELLER) {
      throw new NotFoundException('Vendeur introuvable');
    }

    const existing = await this.followRepo.findOne({
      where: { clientId, sellerId },
    });
    if (existing) {
      return existing;
    }

    const row = this.followRepo.create({ clientId, sellerId });
    return this.followRepo.save(row);
  }

  async isFollowing(clientId: number, sellerId: number): Promise<boolean> {
    const row = await this.followRepo.findOne({
      where: { clientId, sellerId },
    });
    return !!row;
  }

  async listFollowersForSeller(sellerId: number) {
    const rows = await this.followRepo.find({
      where: { sellerId },
      relations: ['client'],
      order: { createdAt: 'DESC' },
    });

    return rows.map((r) => {
      const c = r.client;
      const fullName = [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim();
      return {
        id: r.id,
        clientId: r.clientId,
        email: c?.email,
        firstName: c?.firstName,
        lastName: c?.lastName,
        fullName: fullName || c?.email || '',
        phone: c?.phone,
        createdAt: r.createdAt,
      };
    });
  }

  async listFollowingSellers(clientId: number) {
    const rows = await this.followRepo.find({
      where: { clientId },
      relations: ['seller'],
      order: { createdAt: 'DESC' },
    });

    return rows.map((r) => {
      const s = r.seller;
      const displayName = [s?.firstName, s?.lastName].filter(Boolean).join(' ').trim();
      let sellerPhoto: string | null = null;
      if (s?.photo && Buffer.isBuffer(s.photo)) {
        sellerPhoto = `data:image/jpeg;base64,${s.photo.toString('base64')}`;
      }
      return {
        followId: r.id,
        sellerId: r.sellerId,
        email: s?.email,
        firstName: s?.firstName,
        lastName: s?.lastName,
        displayName: displayName || s?.email || 'Vendeur',
        sellerPhoto,
        createdAt: r.createdAt,
      };
    });
  }

  async remove(followId: number, userId: number, role: UserRole): Promise<void> {
    const row = await this.followRepo.findOne({ where: { id: followId } });
    if (!row) {
      throw new NotFoundException('Abonnement introuvable');
    }

    if (role === UserRole.SELLER && row.sellerId === userId) {
      await this.followRepo.remove(row);
      return;
    }
    if (role === UserRole.CLIENT && row.clientId === userId) {
      await this.followRepo.remove(row);
      return;
    }

    throw new ForbiddenException('Action non autorisée');
  }

  async unfollowBySellerId(clientId: number, sellerId: number): Promise<void> {
    const row = await this.followRepo.findOne({
      where: { clientId, sellerId },
    });
    if (row) {
      await this.followRepo.remove(row);
    }
  }
}
