import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User, UserRole } from '../user/user.entity';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() dto: ChatRequestDto, @Req() req: { user: User }) {
    return this.chatService.chat(dto, req.user);
  }

  /** Rebuild embeddings for catalog (call after bulk imports or model change) */
  @Post('reindex')
  async reindex(@Req() req: { user: User }) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Réservé aux administrateurs');
    }
    return this.chatService.reindexAll();
  }
}