import {
  IsNumber,
  IsOptional,
  IsString,
  IsObject,
  IsArray,
  ValidateNested,
  Min,
  Length,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentMetaDto {
  @IsOptional()
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  cardLast4?: string;

  @IsOptional()
  @IsString()
  cardHolder?: string;
}

export class ShippingAddressDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  country: string;

  @IsString()
  city: string;

  @IsString()
  zipCode: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderItemDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  price: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentMetaDto)
  paymentMeta?: PaymentMetaDto;
}
