import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Currency } from '../../database/entities/currency.entity';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Injectable()
export class CurrenciesService {
  constructor(
    @InjectRepository(Currency)
    private currenciesRepository: Repository<Currency>,
  ) {}

  async findAll(): Promise<Currency[]> {
    return this.currenciesRepository.find({
      where: { isActive: true },
      order: { isDefault: 'DESC', code: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Currency> {
    const currency = await this.currenciesRepository.findOne({ where: { id } });
    if (!currency) {
      throw new NotFoundException('Currency not found');
    }
    return currency;
  }

  async findDefault(): Promise<Currency> {
    const currency = await this.currenciesRepository.findOne({ where: { isDefault: true } });
    if (!currency) {
      throw new NotFoundException('No default currency configured');
    }
    return currency;
  }

  async create(dto: CreateCurrencyDto): Promise<Currency> {
    if (dto.isDefault) {
      await this.currenciesRepository.update({}, { isDefault: false });
    }
    const currency = this.currenciesRepository.create(dto);
    return this.currenciesRepository.save(currency);
  }

  async update(id: string, dto: UpdateCurrencyDto): Promise<Currency> {
    const currency = await this.findOne(id);
    if (dto.isDefault) {
      await this.currenciesRepository.update({ id: Not(id) }, { isDefault: false });
    }
    Object.assign(currency, dto);
    return this.currenciesRepository.save(currency);
  }

  async remove(id: string): Promise<void> {
    const currency = await this.findOne(id);
    currency.isActive = false;
    await this.currenciesRepository.save(currency);
  }
}
