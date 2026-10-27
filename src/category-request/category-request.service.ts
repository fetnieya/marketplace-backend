import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CategoryRequest,
  CategoryRequestStatus,
} from './category-request.entity';
import { CreateCategoryRequestDto } from './dto/create-category-request.dto';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class CategoryRequestService {
  private readonly logger = new Logger(CategoryRequestService.name);

  constructor(
    @InjectRepository(CategoryRequest)
    private readonly categoryRequestRepo: Repository<CategoryRequest>,
    private readonly userService: UserService,
    private readonly mailService: MailService,
  ) {}

  async create(
    sellerId: number,
    dto: CreateCategoryRequestDto,
  ): Promise<CategoryRequest> {
    const seller = await this.userService.findById(sellerId);
    if (!seller || seller.role !== UserRole.SELLER) {
      throw new ForbiddenException('Seuls les vendeurs peuvent demander une catégorie');
    }

    const label = dto.label.trim();
    const description = dto.description?.trim() || undefined;

    const duplicate = await this.categoryRequestRepo.findOne({
      where: {
        sellerId,
        label,
        status: CategoryRequestStatus.PENDING,
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'Une demande avec ce nom est déjà en attente de traitement.',
      );
    }

    const row = this.categoryRequestRepo.create({
      sellerId,
      label,
      description,
      status: CategoryRequestStatus.PENDING,
    });
    const saved = await this.categoryRequestRepo.save(row);

    const sellerName =
      [seller.firstName, seller.lastName].filter(Boolean).join(' ').trim() ||
      seller.email;

    try {
      await this.mailService.sendCategoryRequestToAdmin({
        sellerName,
        sellerEmail: seller.email,
        label,
        description: description || '',
      });
    } catch (err) {
      this.logger.warn(
        `Notification email for category request #${saved.id} failed (request saved)`,
        err,
      );
    }

    return saved;
  }
}
