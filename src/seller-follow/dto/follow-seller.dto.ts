import { IsInt, Min } from 'class-validator';

export class FollowSellerDto {
  @IsInt()
  @Min(1)
  sellerId: number;
}
