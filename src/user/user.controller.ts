import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from './user.entity';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  /** Profil vendeur public (boutique) — sans auth */
  @Get('public/seller/:id')
  async getPublicSeller(@Param('id') id: string) {
    const user = await this.userService.findById(+id);
    if (!user || user.role !== UserRole.SELLER) {
      throw new NotFoundException('Vendeur introuvable');
    }
    let photoOut: string | undefined;
    if (user.photo && Buffer.isBuffer(user.photo)) {
      photoOut = `data:image/jpeg;base64,${user.photo.toString('base64')}`;
    }
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email;
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName,
      phone: user.phone,
      photo: photoOut,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sellers')
  async findSellers() {
    try {
      const sellers = await this.userService.findByRole(UserRole.SELLER);
      // Retourner toujours un tableau, même vide
      // Le service retourne déjà un tableau vide en cas d'erreur
      const result = Array.isArray(sellers) ? sellers : [];
      console.log(`Found ${result.length} seller(s)`);
      return result;
    } catch (error) {
      // Logger l'erreur complète pour le débogage
      console.error('Error fetching sellers in controller:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
        console.error('Error message:', error.message);
      }

      // Retourner un tableau vide avec un message dans la console
      // pour éviter de casser le frontend - NE PAS lever d'exception
      console.warn('Returning empty array due to error in findSellers');
      // Retourner un tableau vide au lieu de lever une exception
      // Cela permet au frontend d'afficher "Aucun vendeur trouvé" au lieu d'une erreur
      return [];
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('clients')
  async findClients() {
    try {
      const clients = await this.userService.findByRole(UserRole.CLIENT);
      return Array.isArray(clients) ? clients : [];
    } catch (error) {
      console.error('Error fetching clients:', error);
      return [];
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return await this.userService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.userService.findById(+id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, photo, ...rest } = user;
    const result: Record<string, unknown> = { ...rest };

    // Convertir la photo Buffer en base64 si elle existe
    if (photo) {
      if (Buffer.isBuffer(photo)) {
        result.photo = `data:image/jpeg;base64,${photo.toString('base64')}`;
      } else {
        // Si c'est déjà une string base64, ajouter le préfixe si nécessaire
        const photoString = String(photo);
        if (!photoString.startsWith('data:')) {
          result.photo = `data:image/jpeg;base64,${photoString}`;
        } else {
          result.photo = photoString;
        }
      }
    }
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: Partial<CreateUserDto>,
  ) {
    try {
      console.log(`Updating user ${id} with data:`, {
        ...updateUserDto,
        photo: updateUserDto.photo
          ? `[Photo data: ${typeof updateUserDto.photo}, length: ${String(updateUserDto.photo).length}]`
          : 'none',
      });

      const user = await this.userService.update(+id, updateUserDto);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, photo, ...rest } = user;
      const result: Record<string, unknown> = { ...rest };

      // Convertir la photo Buffer en base64 si elle existe
      if (photo) {
        if (Buffer.isBuffer(photo)) {
          result.photo = `data:image/jpeg;base64,${photo.toString('base64')}`;
        } else {
          // Si c'est déjà une string base64, ajouter le préfixe si nécessaire
          const photoString = String(photo);
          if (!photoString.startsWith('data:')) {
            result.photo = `data:image/jpeg;base64,${photoString}`;
          } else {
            result.photo = photoString;
          }
        }
      }

      console.log(`User ${id} updated successfully`);
      return result as unknown;
    } catch (error) {
      console.error('Error updating user:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : "Erreur lors de la mise à jour de l'utilisateur",
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    const result = await this.userService.remove(+id);
    if (!result) {
      throw new NotFoundException('User not found');
    }
    return;
  }
}
