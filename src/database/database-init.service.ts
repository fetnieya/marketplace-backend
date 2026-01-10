import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/user.entity';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(private readonly userService: UserService) {}

  async onModuleInit() {
    await this.createDefaultAdmin();
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
}
