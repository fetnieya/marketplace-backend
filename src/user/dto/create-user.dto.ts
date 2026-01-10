import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsDateString,
} from 'class-validator';
import { UserRole } from '../user.entity';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  cin?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  photo?: string; // Base64 string

  @IsOptional()
  @IsString()
  currentPassword?: string; // Pour vérifier le mot de passe actuel lors de la modification

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string; // Optionnel pour la mise à jour

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password_create?: string; // Requis pour la création

  @IsOptional()
  role?: UserRole;
}
