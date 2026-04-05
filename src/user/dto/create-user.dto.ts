import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsDateString,
  ValidateIf,
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
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères',
  })
  password?: string; // Optionnel pour la mise à jour

  // password_create n'est plus dans le DTO - il est géré par le service (utilise le CIN pour les sellers)

  @IsOptional()
  role?: UserRole;
}
