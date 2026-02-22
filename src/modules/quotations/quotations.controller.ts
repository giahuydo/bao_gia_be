import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('quotations')
@ApiBearerAuth()
@Controller('quotations')
@UseGuards(JwtAuthGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a quotation' })
  create(@Body() createDto: CreateQuotationDto, @CurrentUser() user: User) {
    return this.quotationsService.create(createDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List quotations with pagination and filters' })
  findAll(@Query() queryDto: QuotationQueryDto) {
    return this.quotationsService.findAll(queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quotation by ID with items and customer' })
  findOne(@Param('id') id: string) {
    return this.quotationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a quotation' })
  update(@Param('id') id: string, @Body() updateDto: UpdateQuotationDto, @CurrentUser() user: User) {
    return this.quotationsService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a quotation (soft delete)' })
  remove(@Param('id') id: string) {
    return this.quotationsService.remove(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update quotation status' })
  updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateStatusDto, @CurrentUser() user: User) {
    return this.quotationsService.updateStatus(id, updateStatusDto.status, user.id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a quotation' })
  duplicate(@Param('id') id: string, @CurrentUser() user: User) {
    return this.quotationsService.duplicate(id, user.id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Export quotation as PDF' })
  @ApiProduces('application/pdf')
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.quotationsService.generatePdf(id);
    const quotation = await this.quotationsService.findOne(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${quotation.quotationNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
