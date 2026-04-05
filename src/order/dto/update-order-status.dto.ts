import { IsIn, IsString } from 'class-validator';

const STATUSES = [
  'pending',
  'shipped',
  'delivered',
  'processing',
  'cancelled',
] as const;

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn([...STATUSES])
  status: (typeof STATUSES)[number];
}
