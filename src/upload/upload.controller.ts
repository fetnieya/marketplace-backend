import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Vérifier le type de fichier (images seulement pour l'instant)
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    // Vérifier la taille du fichier (pas de limite, comme demandé)
    // Mais on peut quand même ajouter une limite raisonnable pour éviter les abus
    // const maxSize = 100 * 1024 * 1024; // 100 MB
    // if (file.size > maxSize) {
    //   throw new BadRequestException(`File too large. Maximum size: ${maxSize / 1024 / 1024} MB`);
    // }

    // Convertir le fichier en base64
    const base64 = file.buffer.toString('base64');
    const mimeType = file.mimetype;
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return {
      url: dataUrl,
      secure_url: dataUrl, // Pour compatibilité avec Cloudinary
      public_id: file.originalname,
      format: mimeType.split('/')[1],
      width: null,
      height: null,
      bytes: file.size,
    };
  }
}