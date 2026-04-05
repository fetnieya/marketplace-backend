import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private mailService: MailService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Vérifier si le CIN existe déjà (si fourni)
    if (createUserDto.cin) {
      const existingCIN = await this.userRepository.findOne({
        where: { cin: createUserDto.cin },
      });
      if (existingCIN) {
        throw new ConflictException('User with this CIN already exists');
      }
    }

    // Pour les sellers créés par l'admin, utiliser le CIN comme mot de passe par défaut
    const isSeller = createUserDto.role === UserRole.SELLER;
    let passwordToHash = createUserDto.password || '';

    if (isSeller && !passwordToHash && createUserDto.cin) {
      // Utiliser le CIN comme mot de passe par défaut pour les sellers
      passwordToHash = createUserDto.cin;
    }

    if (!passwordToHash) {
      throw new ConflictException('Le mot de passe est requis');
    }
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);
    const plainPassword = passwordToHash; // Garder le mot de passe en clair pour l'email

    // Convertir dateOfBirth de string à Date si fourni
    const userData: Partial<User> & {
      password: string;
      dateOfBirth?: Date;
      photo?: Buffer;
    } = {
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: createUserDto.email,
      phone: createUserDto.phone,
      cin: createUserDto.cin,
      password: hashedPassword,
      role: createUserDto.role || UserRole.CLIENT,
    };

    // Convertir la date de naissance si elle est fournie
    if (createUserDto.dateOfBirth) {
      userData.dateOfBirth = new Date(createUserDto.dateOfBirth);
    }

    // Convertir la photo base64 en Buffer si fournie
    if (createUserDto.photo) {
      try {
        const base64Data = createUserDto.photo.replace(
          /^data:image\/\w+;base64,/,
          '',
        );

        // Vérifier la taille de la photo (max 50 MB)
        const photoSizeBytes = (base64Data.length * 3) / 4;
        const maxSizeBytes = 50 * 1024 * 1024; // 50 MB

        if (photoSizeBytes > maxSizeBytes) {
          throw new ConflictException(
            `La photo est trop volumineuse (${Math.round(photoSizeBytes / 1024 / 1024)} MB). Maximum autorisé: 50 MB`,
          );
        }

        userData.photo = Buffer.from(base64Data, 'base64');
        console.log(
          `Photo converted to Buffer, size: ${userData.photo.length} bytes (${Math.round(userData.photo.length / 1024 / 1024)} MB)`,
        );
      } catch (error) {
        console.error('Error converting photo to Buffer:', error);
        if (error instanceof ConflictException) {
          throw error;
        }
        throw new ConflictException('Format de photo invalide');
      }
    }

    const user = this.userRepository.create(userData);
    const savedUser = await this.userRepository.save(user);

    // Envoyer un email avec les identifiants si c'est un seller
    if (isSeller && savedUser.email) {
      try {
        await this.mailService.sendSellerCredentials(
          savedUser.email,
          savedUser.firstName,
          savedUser.lastName,
          savedUser.email,
          plainPassword,
        );
      } catch (error) {
        // Ne pas bloquer la création si l'email échoue
        console.error("Erreur lors de l'envoi de l'email:", error);
      }
    }

    return savedUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
    });
  }

  async findById(id: number): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id },
    });
    // Convertir la photo Buffer en base64 si elle existe
    if (user && user.photo) {
      user.photo = Buffer.from(user.photo).toString('base64') as any;
    }
    return user;
  }

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find({
      select: [
        'id',
        'firstName',
        'lastName',
        'email',
        'phone',
        'cin',
        'dateOfBirth',
        'photo',
        'role',
        'createdAt',
        'updatedAt',
      ],
    });
    // Convertir les photos Buffer en base64
    return users.map((user) => {
      if (user.photo) {
        user.photo = Buffer.from(user.photo).toString('base64') as any;
      }
      return user;
    });
  }

  async findAdminByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email, role: UserRole.ADMIN },
    });
  }

  async findByRole(role: UserRole): Promise<User[]> {
    try {
      // Convertir l'enum en string pour la requête
      const roleValue = role as string;
      console.log(`Searching for users with role: ${roleValue}`);

      // Utiliser createQueryBuilder pour éviter les problèmes avec les enums MySQL
      const users = await this.userRepository
        .createQueryBuilder('user')
        .where('user.role = :role', { role: roleValue })
        .select([
          'user.id',
          'user.firstName',
          'user.lastName',
          'user.email',
          'user.phone',
          'user.cin',
          'user.dateOfBirth',
          'user.photo',
          'user.role',
          'user.createdAt',
          'user.updatedAt',
        ])
        .getMany();

      // Convertir les photos Buffer en base64
      const result = users.map((user) => {
        if (user.photo) {
          user.photo = Buffer.from(user.photo).toString('base64') as any;
        }
        return user;
      });

      console.log(`Found ${result.length} user(s) with role ${roleValue}`);
      return result;
    } catch (error: unknown) {
      console.error('Error in findByRole:', error);
      console.error('Role value:', role);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Error details:', {
        message: errorMessage,
        stack: errorStack,
      });
      // Retourner un tableau vide plutôt que de lancer une erreur
      // pour éviter de casser l'interface
      // Cela permet au frontend d'afficher "Aucun vendeur trouvé" au lieu d'une erreur
      console.warn(`Returning empty array for role ${role} due to error`);
      return [];
    }
  }

  async update(
    id: number,
    updateUserDto: Partial<CreateUserDto>,
  ): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        console.log(`User with id ${id} not found`);
        return null;
      }

      // Vérifier si le CIN existe déjà pour un autre utilisateur (si fourni)
      if (updateUserDto.cin && updateUserDto.cin !== user.cin) {
        const existingCIN = await this.userRepository.findOne({
          where: { cin: updateUserDto.cin },
        });
        if (existingCIN) {
          throw new ConflictException('User with this CIN already exists');
        }
      }

      const updateData: Partial<User> = {};

      // Mettre à jour les champs de base
      if (updateUserDto.firstName !== undefined) {
        updateData.firstName = updateUserDto.firstName;
      }
      if (updateUserDto.lastName !== undefined) {
        updateData.lastName = updateUserDto.lastName;
      }
      if (updateUserDto.email !== undefined) {
        updateData.email = updateUserDto.email;
      }
      if (updateUserDto.phone !== undefined) {
        updateData.phone = updateUserDto.phone || undefined;
      }
      if (updateUserDto.cin !== undefined) {
        updateData.cin = updateUserDto.cin || undefined;
      }
      if (updateUserDto.role) {
        updateData.role = updateUserDto.role;
      }

      // Convertir la date de naissance si elle est fournie
      if (updateUserDto.dateOfBirth !== undefined) {
        updateData.dateOfBirth = updateUserDto.dateOfBirth
          ? new Date(updateUserDto.dateOfBirth)
          : undefined;
      }

      // Convertir la photo base64 en Buffer si fournie
      if (updateUserDto.photo !== undefined) {
        if (updateUserDto.photo === null || updateUserDto.photo === '') {
          // Si photo est null ou vide, supprimer la photo
          updateData.photo = undefined;
        } else if (typeof updateUserDto.photo === 'string') {
          try {
            // Supprimer le préfixe data:image/...;base64, si présent
            const base64Data = updateUserDto.photo.replace(
              /^data:image\/\w+;base64,/,
              '',
            );

            // Vérifier la taille de la photo (max 50 MB pour éviter les problèmes)
            const photoSizeBytes = (base64Data.length * 3) / 4;
            const maxSizeBytes = 50 * 1024 * 1024; // 50 MB

            if (photoSizeBytes > maxSizeBytes) {
              throw new ConflictException(
                `La photo est trop volumineuse (${Math.round(photoSizeBytes / 1024 / 1024)} MB). Maximum autorisé: 50 MB`,
              );
            }

            updateData.photo = Buffer.from(base64Data, 'base64');
            console.log(
              `Photo converted to Buffer, size: ${updateData.photo.length} bytes (${Math.round(updateData.photo.length / 1024 / 1024)} MB)`,
            );
          } catch (error) {
            console.error('Error converting photo to Buffer:', error);
            if (error instanceof ConflictException) {
              throw error;
            }
            throw new ConflictException('Format de photo invalide');
          }
        } else {
          updateData.photo = updateUserDto.photo as any;
        }
      }

      // Vérifier le mot de passe actuel avant de le modifier
      if (updateUserDto.password && updateUserDto.currentPassword) {
        const isPasswordValid = await bcrypt.compare(
          updateUserDto.currentPassword,
          user.password,
        );
        if (!isPasswordValid) {
          throw new ConflictException('Le mot de passe actuel est incorrect');
        }
        updateData.password = await bcrypt.hash(updateUserDto.password, 10);
      } else if (updateUserDto.password) {
        // Si pas de currentPassword fourni, hasher directement (pour compatibilité)
        updateData.password = await bcrypt.hash(updateUserDto.password, 10);
      }

      // Appliquer les modifications
      Object.assign(user, updateData);

      // Sauvegarder les modifications
      const savedUser = await this.userRepository.save(user);
      console.log(`User ${id} updated successfully`);
      return savedUser;
    } catch (error) {
      console.error(`Error updating user ${id}:`, error);
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new ConflictException(
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour de l'utilisateur",
      );
    }
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.userRepository.delete(id);
    return (
      result.affected !== undefined &&
      result.affected !== null &&
      result.affected > 0
    );
  }
}
