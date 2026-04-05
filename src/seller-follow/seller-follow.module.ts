import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerFollow } from './seller-follow.entity';
import { SellerFollowService } from './seller-follow.service';
import { SellerFollowController } from './seller-follow.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([SellerFollow]), UserModule],
  controllers: [SellerFollowController],
  providers: [SellerFollowService],
  exports: [SellerFollowService],
})
export class SellerFollowModule {}
