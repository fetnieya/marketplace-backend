import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateImageDto {
  @IsString()
  @IsNotEmpty()
  data: string; // Base64 string

  @IsNumber()
  productId: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  order?: number;
}