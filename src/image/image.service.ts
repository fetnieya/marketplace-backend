import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Image } from './image.entity';
import { CreateImageDto } from './dto/create-image.dto';

@Injectable()
export class ImageService {
  constructor(
    @InjectRepository(Image)
    private imageRepository: Repository<Image>,
  ) {}

  async create(createImageDto: CreateImageDto): Promise<Image> {
    try {
      // Convertir le base64 en Buffer
      const base64Data = createImageDto.data.replace(
        /^data:image\/\w+;base64,/,
        '',
      );

      // Vérifier la taille de l'image (max 50 MB)
      const imageSizeBytes = (base64Data.length * 3) / 4;
      const maxSizeBytes = 50 * 1024 * 1024; // 50 MB

      if (imageSizeBytes > maxSizeBytes) {
        throw new ConflictException(
          `L'image est trop volumineuse (${Math.round(imageSizeBytes / 1024 / 1024)} MB). Maximum autorisé: 50 MB`,
        );
      }

      const imageData = Buffer.from(base64Data, 'base64');

      const image = this.imageRepository.create({
        data: imageData,
        productId: createImageDto.productId,
        order: createImageDto.order || 0,
      });

      return await this.imageRepository.save(image);
    } catch (error) {
      console.error('Error converting image to Buffer:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new ConflictException('Format d\'image invalide');
    }
  }

  async createMany(imagesData: string[], productId: number): Promise<Image[]> {
    const images = imagesData.map((imageData, index) => {
      try {
        // Convertir le base64 en Buffer
        const base64Data = imageData.replace(
          /^data:image\/\w+;base64,/,
          '',
        );

        // Vérifier la taille de l'image (max 50 MB)
        const imageSizeBytes = (base64Data.length * 3) / 4;
        const maxSizeBytes = 50 * 1024 * 1024; // 50 MB

        if (imageSizeBytes > maxSizeBytes) {
          throw new ConflictException(
            `L'image est trop volumineuse (${Math.round(imageSizeBytes / 1024 / 1024)} MB). Maximum autorisé: 50 MB`,
          );
        }

        const buffer = Buffer.from(base64Data, 'base64');

        return this.imageRepository.create({
          data: buffer,
          productId,
          order: index,
        });
      } catch (error) {
        console.error('Error converting image to Buffer:', error);
        if (error instanceof ConflictException) {
          throw error;
        }
        throw new ConflictException('Format d\'image invalide');
      }
    });

    return await this.imageRepository.save(images);
  }

  async findAll(productId?: number): Promise<Image[]> {
    const where = productId ? { productId } : {};
    return await this.imageRepository.find({
      where,
      order: {
        order: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async findByProductId(productId: number): Promise<Image[]> {
    return await this.imageRepository.find({
      where: { productId },
      order: {
        order: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async findOne(id: number): Promise<Image> {
    const image = await this.imageRepository.findOne({
      where: { id },
    });

    if (!image) {
      throw new NotFoundException(`Image with ID ${id} not found`);
    }

    return image;
  }

  async remove(id: number): Promise<void> {
    const image = await this.imageRepository.findOne({
      where: { id },
    });

    if (!image) {
      throw new NotFoundException(`Image with ID ${id} not found`);
    }

    await this.imageRepository.remove(image);
  }

  async removeByProductId(productId: number): Promise<void> {
    await this.imageRepository.delete({ productId });
  }

  async removeMany(ids: number[]): Promise<void> {
    if (ids.length === 0) return;

    await this.imageRepository.delete({ id: In(ids) });
  }

  async updateProductImages(
    productId: number,
    imagesData: string[],
  ): Promise<Image[]> {
    // Supprimer toutes les images existantes du produit
    await this.removeByProductId(productId);

    // Créer les nouvelles images
    if (imagesData.length > 0) {
      return await this.createMany(imagesData, productId);
    }

    return [];
  }

  async getMainImageUrl(productId: number): Promise<string | null> {
    const images = await this.findByProductId(productId);
    if (images.length > 0 && images[0].data) {
      return `data:image/jpeg;base64,${images[0].data.toString('base64')}`;
    }
    return null;
  }
}