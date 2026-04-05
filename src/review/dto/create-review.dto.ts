import { IsInt, IsString, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  productId: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  comment: string;

  @IsOptional()
  @IsString()
  productColor?: string;

  @IsOptional()
  @IsString()
  productSize?: string;

  @IsOptional()
  @IsBoolean()
  verifiedPurchase?: boolean;
}
