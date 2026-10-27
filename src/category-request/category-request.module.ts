import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryRequest } from './category-request.entity';
import { CategoryRequestService } from './category-request.service';
import { CategoryRequestController } from './category-request.controller';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CategoryRequest]),
    UserModule,
    MailModule,
  ],
  controllers: [CategoryRequestController],
  providers: [CategoryRequestService],
  exports: [CategoryRequestService],
})
export class CategoryRequestModule {}
