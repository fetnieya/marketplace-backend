import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from '../user/dto/login.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return {
      message: 'User created successfully',
      user: result,
    };
  }
}
