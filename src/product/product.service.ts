import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductStatus } from './product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CategoryService } from '../category/category.service';
import { ImageService } from '../image/image.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private categoryService: CategoryService,
    private imageService: ImageService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    // Vérifier que la catégorie existe
    await this.categoryService.findOne(createProductDto.categoryId);

    // Créer le produit sans les images
    const { images, ...productData } = createProductDto;

    const product = this.productRepository.create({
      ...productData,
      status: createProductDto.status || ProductStatus.DISPONIBLE,
      quantity: createProductDto.quantity || 1,
    });

    const savedProduct = await this.productRepository.save(product);

    // Créer les images dans la table séparée
    if (images && images.length > 0) {
      await this.imageService.createMany(images, savedProduct.id);
      // Mettre à jour l'image principale pour compatibilité
      savedProduct.image = images[0];
      await this.productRepository.save(savedProduct);
    }

    // Incrémenter le nombre de produits de la catégorie
    await this.categoryService.incrementProductCount(
      createProductDto.categoryId,
    );

    // Recharger le produit avec les images (sera sérialisé dans findOne)
    return await this.findOne(savedProduct.id);
  }

  async findAll(
    sellerId?: number,
    categoryId?: number,
    search?: string,
  ): Promise<Product[]> {
    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.seller', 'seller')
      .leftJoinAndSelect('product.images', 'images')
      .orderBy('product.createdAt', 'DESC');

    if (sellerId != null) {
      qb.andWhere('product.sellerId = :sellerId', { sellerId });
    }
    if (categoryId != null) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId });
    }
    const q = search?.trim();
    if (q) {
      qb.andWhere('LOWER(product.name) LIKE LOWER(:q)', { q: `%${q}%` });
    }

    const products = await qb.getMany();
    return products.map((product) => this.serializeProduct(product));
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'seller', 'images'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.serializeProduct(product);
  }

  private serializeProduct(product: Product): Product {
    // Convertir les images Buffer en base64
    if (product.images && product.images.length > 0) {
      product.images = product.images.map((image) => {
        const imageObj: any = { ...image };
        if (image.data && Buffer.isBuffer(image.data)) {
          imageObj.url = `data:image/jpeg;base64,${image.data.toString('base64')}`;
        }
        imageObj.data = undefined; // Ne pas envoyer le Buffer
        return imageObj;
      }) as any;
    }

    // Exposer le nom et la photo du vendeur (sans renvoyer l'objet seller complet)
    const result = { ...product } as any;
    if (product.seller) {
      const seller = product.seller as any;
      result.sellerName =
        [seller.firstName, seller.lastName].filter(Boolean).join(' ').trim() ||
        seller.email ||
        '';
      result.sellerId = result.sellerId ?? seller.id;
      if (seller.photo && Buffer.isBuffer(seller.photo)) {
        result.sellerPhoto = `data:image/jpeg;base64,${seller.photo.toString('base64')}`;
      } else {
        result.sellerPhoto = null;
      }
    } else {
      result.sellerPhoto = null;
    }
    delete result.seller;
    return result;
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Si la catégorie change, mettre à jour les compteurs
    if (updateProductDto.categoryId && updateProductDto.categoryId !== product.categoryId) {
      await this.categoryService.decrementProductCount(product.categoryId);
      await this.categoryService.findOne(updateProductDto.categoryId);
      await this.categoryService.incrementProductCount(updateProductDto.categoryId);
    }

    // Gérer les images séparément
    const { images, ...productData } = updateProductDto;

    // Mettre à jour les images si elles sont fournies
    if (images !== undefined) {
      // Supprimer les anciennes images et créer les nouvelles
      await this.imageService.updateProductImages(id, images);
      // Mettre à jour l'image principale pour compatibilité
      if (images.length > 0) {
        productData.image = images[0];
      } else {
        productData.image = undefined;
      }
    }

    Object.assign(product, productData);

    await this.productRepository.save(product);

    // Recharger le produit avec les images
    return await this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Supprimer toutes les images associées (CASCADE le fera automatiquement, mais on le fait explicitement pour être sûr)
    await this.imageService.removeByProductId(id);

    // Décrémenter le nombre de produits de la catégorie
    await this.categoryService.decrementProductCount(product.categoryId);

    await this.productRepository.remove(product);
  }

  async updateQuantity(id: number, quantity: number): Promise<Product> {
    const product = await this.findOne(id);

    if (quantity < 0) {
      throw new BadRequestException('Quantity cannot be negative');
    }

    product.quantity = quantity;
    return await this.productRepository.save(product);
  }

  async decrementQuantity(id: number, amount: number = 1): Promise<Product> {
    const product = await this.findOne(id);

    product.quantity = Math.max(0, product.quantity - amount);
    return await this.productRepository.save(product);
  }
}