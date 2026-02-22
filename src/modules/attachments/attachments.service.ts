import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Attachment } from '../../database/entities/attachment.entity';

@Injectable()
export class AttachmentsService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'attachments');

  constructor(
    @InjectRepository(Attachment)
    private attachmentsRepository: Repository<Attachment>,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(
    file: Express.Multer.File,
    quotationId: string,
    userId: string,
  ): Promise<Attachment> {
    const ext = path.extname(file.originalname);
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(this.uploadDir, fileName);

    fs.writeFileSync(filePath, file.buffer);

    const attachment = this.attachmentsRepository.create({
      quotationId,
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath: filePath,
      uploadedBy: userId,
    });

    return this.attachmentsRepository.save(attachment);
  }

  async findByQuotation(quotationId: string): Promise<Attachment[]> {
    return this.attachmentsRepository.find({
      where: { quotationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Attachment> {
    const attachment = await this.attachmentsRepository.findOne({ where: { id } });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return attachment;
  }

  async remove(id: string): Promise<void> {
    const attachment = await this.findOne(id);
    if (fs.existsSync(attachment.filePath)) {
      fs.unlinkSync(attachment.filePath);
    }
    await this.attachmentsRepository.remove(attachment);
  }

  async getFilePath(id: string): Promise<{ path: string; originalName: string; mimeType: string }> {
    const attachment = await this.findOne(id);
    return {
      path: attachment.filePath,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
    };
  }
}
