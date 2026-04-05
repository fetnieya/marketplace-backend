import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CategoryService } from '../category/category.service';
import { UserRole } from '../user/user.entity';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(
    private readonly userService: UserService,
    private readonly categoryService: CategoryService,
  ) {}

  async onModuleInit() {
    await this.createDefaultAdmin();
    await this.createDefaultCategories();
  }

  private async createDefaultAdmin() {
    const adminEmail = 'admin@gmail.com';
    const adminPassword = 'Admin123!';
    const adminFirstName = 'Admin';
    const adminLastName = 'System';

    try {
      const existingAdmin = await this.userService.findAdminByEmail(adminEmail);

      if (existingAdmin) {
        this.logger.log('Admin user already exists');
        return;
      }

      await this.userService.create({
        firstName: adminFirstName,
        lastName: adminLastName,
        email: adminEmail,
        password: adminPassword,
        role: UserRole.ADMIN,
      });

      this.logger.log('Default admin user created successfully');
      this.logger.log(`Email: ${adminEmail}`);
      this.logger.log(`Password: ${adminPassword}`);
    } catch (error) {
      this.logger.error('Error creating default admin:', error);
    }
  }

  private async createDefaultCategories() {
    // Catégories inspirées de Facebook Marketplace
    const defaultCategories = [
      {
        label: 'Véhicules',
        description: 'Voitures, motos, vélos et autres moyens de transport',
        icon: 'ai-car',
      },
      {
        label: 'Immobilier',
        description: 'Maisons, appartements, terrains à vendre ou à louer',
        icon: 'ai-home',
      },
      {
        label: 'Vêtements & Accessoires',
        description: 'Vêtements, chaussures, sacs et accessoires de mode',
        icon: 'ai-shirt',
      },
      {
        label: 'Électronique',
        description:
          'Téléphones, ordinateurs, téléviseurs et gadgets électroniques',
        icon: 'ai-smartphone',
      },
      {
        label: 'Maison & Jardin',
        description:
          'Meubles, décoration, électroménager et articles de jardinage',
        icon: 'ai-home-alt',
      },
      {
        label: 'Sports & Loisirs',
        description:
          'Équipements sportifs, jeux, instruments de musique et loisirs',
        icon: 'ai-football',
      },
      {
        label: 'Emploi',
        description:
          "Offres d'emploi, services professionnels et opportunités de carrière",
        icon: 'ai-briefcase',
      },
      {
        label: 'Services',
        description:
          'Services professionnels, cours particuliers et prestations',
        icon: 'ai-tools',
      },
      {
        label: 'Animaux',
        description:
          'Animaux domestiques, accessoires et produits pour animaux',
        icon: 'ai-heart',
      },
      {
        label: 'Livres & Médias',
        description:
          'Livres, films, musique, jeux vidéo et produits multimédias',
        icon: 'ai-book',
      },
      {
        label: 'Beauté & Santé',
        description: 'Produits de beauté, cosmétiques et articles de santé',
        icon: 'ai-sparkles',
      },
      {
        label: 'Bébés & Enfants',
        description: 'Articles pour bébés, jouets et vêtements enfants',
        icon: 'ai-baby',
      },
      {
        label: 'Outils & Matériaux',
        description:
          'Outils de bricolage, matériaux de construction et fournitures',
        icon: 'ai-wrench',
      },
      {
        label: 'Autres',
        description: 'Autres articles et produits non catégorisés',
        icon: 'ai-grid',
      },
    ];

    try {
      let createdCount = 0;
      let existingCount = 0;

      for (const categoryData of defaultCategories) {
        try {
          await this.categoryService.create({
            label: categoryData.label,
            description: categoryData.description,
            icon: categoryData.icon,
            numberOfProducts: 0,
          });
          createdCount++;
        } catch (error) {
          // Si la catégorie existe déjà, on ignore l'erreur
          if (error.message && error.message.includes('already exists')) {
            existingCount++;
          } else {
            this.logger.error(
              `Error creating category ${categoryData.label}:`,
              error,
            );
          }
        }
      }

      if (createdCount > 0) {
        this.logger.log(
          `Default categories created successfully: ${createdCount} created`,
        );
      }
      if (existingCount > 0) {
        this.logger.log(
          `${existingCount} categories already exist in the database`,
        );
      }
    } catch (error) {
      this.logger.error('Error creating default categories:', error);
    }
  }
}
