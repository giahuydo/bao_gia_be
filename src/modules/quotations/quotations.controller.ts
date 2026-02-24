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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { SendEmailDto } from './dto/send-email.dto';
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
  create(@Body() createDto: CreateQuotationDto, @CurrentUser() user: any) {
    return this.quotationsService.create(createDto, user.id, user.organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List quotations with pagination and filters' })
  findAll(@Query() queryDto: QuotationQueryDto, @CurrentUser() user: any) {
    return this.quotationsService.findAll(queryDto, user.organizationId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard stats for the organization' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics including totals, status breakdown, revenue, and monthly trend' })
  getDashboard(@CurrentUser() user: any) {
    return this.quotationsService.getDashboard(user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quotation by ID with items and customer' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotationsService.findOne(id, user.organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a quotation' })
  update(@Param('id') id: string, @Body() updateDto: UpdateQuotationDto, @CurrentUser() user: any) {
    return this.quotationsService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a quotation (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotationsService.remove(id, user.organizationId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update quotation status' })
  updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateStatusDto, @CurrentUser() user: any) {
    return this.quotationsService.updateStatus(id, updateStatusDto.status, user.id, user.organizationId);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a quotation' })
  duplicate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotationsService.duplicate(id, user.id, user.organizationId);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Export quotation as PDF' })
  @ApiProduces('application/pdf')
  async exportPdf(@Param('id') id: string, @Res() res: Response, @CurrentUser() user: any) {
    const pdfBuffer = await this.quotationsService.generatePdf(id);
    const quotation = await this.quotationsService.findOne(id, user.organizationId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${quotation.quotationNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Post(':id/send-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send quotation via email as PDF attachment' })
  @ApiResponse({ status: 200, description: 'Email sent successfully and quotation status updated to sent' })
  @ApiResponse({ status: 400, description: 'Email service not configured or invalid input' })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  async sendEmail(
    @Param('id') id: string,
    @Body() sendEmailDto: SendEmailDto,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; message: string }> {
    await this.quotationsService.sendEmail(id, sendEmailDto, user.id, user.organizationId);
    return { success: true, message: 'Email sent successfully' };
  }
}
