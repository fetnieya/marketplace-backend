import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
