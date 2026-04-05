import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const existingCategory = await this.categoryRepository.findOne({
      where: { label: createCategoryDto.label },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this label already exists');
    }

    const category = this.categoryRepository.create({
      label: createCategoryDto.label,
      description: createCategoryDto.description,
      numberOfProducts: createCategoryDto.numberOfProducts || 0,
      icon: createCategoryDto.icon,
    });

    return await this.categoryRepository.save(category);
  }

  async findAll(): Promise<Category[]> {
    return await this.categoryRepository.find({
      order: {
        label: 'ASC',
      },
    });
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Vérifier si le label est modifié et s'il existe déjà
    if (updateCategoryDto.label && updateCategoryDto.label !== category.label) {
      const existingCategory = await this.categoryRepository.findOne({
        where: { label: updateCategoryDto.label },
      });

      if (existingCategory) {
        throw new ConflictException('Category with this label already exists');
      }
    }

    Object.assign(category, updateCategoryDto);

    return await this.categoryRepository.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    await this.categoryRepository.remove(category);
  }

  async incrementProductCount(id: number): Promise<void> {
    const category = await this.findOne(id);
    category.numberOfProducts = (category.numberOfProducts || 0) + 1;
    await this.categoryRepository.save(category);
  }

  async decrementProductCount(id: number): Promise<void> {
    const category = await this.findOne(id);
    if (category.numberOfProducts > 0) {
      category.numberOfProducts -= 1;
      await this.categoryRepository.save(category);
    }
  }
}
