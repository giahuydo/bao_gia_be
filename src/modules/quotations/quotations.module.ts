import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { Quotation } from '../../database/entities/quotation.entity';
import { QuotationItem } from '../../database/entities/quotation-item.entity';
import { QuotationHistory } from '../../database/entities/quotation-history.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Product } from '../../database/entities/product.entity';
import { CompanySettings } from '../../database/entities/company-settings.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quotation, QuotationItem, QuotationHistory, Customer, Product, CompanySettings]),
    EmailModule,
  ],
  controllers: [QuotationsController],
  providers: [QuotationsService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
