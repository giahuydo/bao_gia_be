import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Attachment } from '../../database/entities/attachment.entity';

@Injectable()
export class AttachmentsService {
  private readonly baseUploadDir = path.join(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(Attachment)
    private attachmentsRepository: Repository<Attachment>,
  ) {
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  private getUploadDir(organizationId: string): string {
    const dir = path.join(this.baseUploadDir, organizationId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  async upload(
    file: Express.Multer.File,
    quotationId: string,
    userId: string,
    organizationId: string,
  ): Promise<Attachment> {
    const ext = path.extname(file.originalname);
    const fileName = `${uuidv4()}${ext}`;
    const uploadDir = this.getUploadDir(organizationId);
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, file.buffer);

    const attachment = this.attachmentsRepository.create({
      quotationId,
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      filePath: filePath,
      uploadedBy: userId,
      organizationId,
    });

    return this.attachmentsRepository.save(attachment);
  }

  async findByQuotation(quotationId: string, organizationId?: string): Promise<Attachment[]> {
    const where: any = { quotationId };
    if (organizationId) where.organizationId = organizationId;
    return this.attachmentsRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, organizationId?: string): Promise<Attachment> {
    const where: any = { id };
    if (organizationId) where.organizationId = organizationId;
    const attachment = await this.attachmentsRepository.findOne({ where });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return attachment;
  }

  async remove(id: string, organizationId?: string): Promise<void> {
    const attachment = await this.findOne(id, organizationId);
    if (fs.existsSync(attachment.filePath)) {
      fs.unlinkSync(attachment.filePath);
    }
    await this.attachmentsRepository.remove(attachment);
  }

  async getFilePath(id: string, organizationId?: string): Promise<{ path: string; originalName: string; mimeType: string }> {
    const attachment = await this.findOne(id, organizationId);
    return {
      path: attachment.filePath,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
    };
  }
}
