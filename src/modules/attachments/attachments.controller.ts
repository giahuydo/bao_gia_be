import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('quotations/:quotationId/attachments')
  @ApiOperation({ summary: 'Upload attachment for a quotation' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('quotationId') quotationId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.attachmentsService.upload(file, quotationId, user.id);
  }

  @Get('quotations/:quotationId/attachments')
  @ApiOperation({ summary: 'List attachments for a quotation' })
  findByQuotation(@Param('quotationId') quotationId: string) {
    return this.attachmentsService.findByQuotation(quotationId);
  }

  @Get('attachments/:id/download')
  @ApiOperation({ summary: 'Download an attachment' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const fileInfo = await this.attachmentsService.getFilePath(id);
    res.set({
      'Content-Type': fileInfo.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.originalName)}"`,
    });
    const stream = fs.createReadStream(fileInfo.path);
    stream.pipe(res);
  }

  @Delete('attachments/:id')
  @ApiOperation({ summary: 'Delete an attachment' })
  remove(@Param('id') id: string) {
    return this.attachmentsService.remove(id);
  }
}
