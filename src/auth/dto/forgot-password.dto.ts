import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsNotEmpty({ message: "L'email est requis" })
  @IsEmail({}, { message: "L'email doit être valide" })
  email: string;
}

export class VerifyCodeDto {
  @IsNotEmpty({ message: "L'email est requis" })
  @IsEmail({}, { message: "L'email doit être valide" })
  email: string;

  @IsNotEmpty({ message: 'Le code est requis' })
  code: string;
}

export class ResetPasswordDto {
  @IsNotEmpty({ message: "L'email est requis" })
  @IsEmail({}, { message: "L'email doit être valide" })
  email: string;

  @IsNotEmpty({ message: 'Le code est requis' })
  code: string;

  @IsNotEmpty({ message: 'Le nouveau mot de passe est requis' })
  @MinLength(6, {
    message: 'Le nouveau mot de passe doit contenir au moins 6 caractères',
  })
  newPassword: string;
}
