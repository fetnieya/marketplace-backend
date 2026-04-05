import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { UserService } from '../user/user.service';
import { LoginDto } from '../user/dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  ForgotPasswordDto,
  VerifyCodeDto,
  ResetPasswordDto,
} from './dto/forgot-password.dto';
import * as bcrypt from 'bcrypt';
import { User } from '../user/user.entity';
import { ResetCode } from './entities/reset-code.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @InjectRepository(ResetCode)
    private resetCodeRepository: Repository<ResetCode>,
    private mailService: MailService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Vérifier si c'est la première connexion (mot de passe = CIN)
    const fullUser = await this.userService.findByEmail(loginDto.email);
    let mustChangePassword = false;
    if (fullUser && fullUser.cin) {
      const isCinPassword = await bcrypt.compare(
        fullUser.cin,
        fullUser.password,
      );
      mustChangePassword = isCinPassword;
    }

    let photoOut: string | undefined;
    if (fullUser?.photo) {
      const p = fullUser.photo;
      if (Buffer.isBuffer(p)) {
        photoOut = `data:image/jpeg;base64,${p.toString('base64')}`;
      } else {
        const photoString = String(p);
        photoOut = photoString.startsWith('data:')
          ? photoString
          : `data:image/jpeg;base64,${photoString}`;
      }
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        ...(photoOut ? { photo: photoOut } : {}),
      },
      mustChangePassword,
    };
  }

  async validateToken(payload: any): Promise<User> {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Le mot de passe actuel est incorrect');
    }

    // Vérifier que les nouveaux mots de passe correspondent
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException(
        'Les nouveaux mots de passe ne correspondent pas',
      );
    }

    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      user.password,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        "Le nouveau mot de passe doit être différent de l'ancien",
      );
    }

    // Mettre à jour le mot de passe
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.userService.update(userId, { password: hashedPassword } as any);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const user = await this.userService.findByEmail(forgotPasswordDto.email);
    if (!user) {
      // Ne pas révéler que l'email n'existe pas pour des raisons de sécurité
      return;
    }

    // Générer un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Supprimer les anciens codes pour cet email
    await this.resetCodeRepository.delete({ email: forgotPasswordDto.email });

    // Créer un nouveau code (valide pendant 15 minutes)
    const resetCode = this.resetCodeRepository.create({
      email: forgotPasswordDto.email,
      code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });
    await this.resetCodeRepository.save(resetCode);

    // Envoyer l'email avec le code
    await this.mailService.sendResetCode(
      forgotPasswordDto.email,
      code,
      user.firstName,
      user.lastName,
    );
  }

  async verifyCode(verifyCodeDto: VerifyCodeDto): Promise<boolean> {
    // Supprimer les codes expirés
    await this.resetCodeRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    const resetCode = await this.resetCodeRepository.findOne({
      where: {
        email: verifyCodeDto.email,
        code: verifyCodeDto.code,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!resetCode || resetCode.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    // Vérifier le code
    const isValid = await this.verifyCode({
      email: resetPasswordDto.email,
      code: resetPasswordDto.code,
    });

    if (!isValid) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    const user = await this.userService.findByEmail(resetPasswordDto.email);
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Mettre à jour le mot de passe
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    await this.userService.update(user.id, { password: hashedPassword } as any);

    // Supprimer le code utilisé
    await this.resetCodeRepository.delete({
      email: resetPasswordDto.email,
      code: resetPasswordDto.code,
    });
  }
}
