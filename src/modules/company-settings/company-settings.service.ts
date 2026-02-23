import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanySettings } from '../../database/entities/company-settings.entity';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@Injectable()
export class CompanySettingsService {
  constructor(
    @InjectRepository(CompanySettings)
    private settingsRepository: Repository<CompanySettings>,
  ) {}

  async get(organizationId: string): Promise<CompanySettings> {
    let settings = await this.settingsRepository.findOne({ where: { organizationId } });
    if (!settings) {
      settings = this.settingsRepository.create({
        companyName: 'My Company',
        quotationPrefix: 'BG',
        organizationId,
      });
      settings = await this.settingsRepository.save(settings);
    }
    return settings;
  }

  async update(dto: UpdateCompanySettingsDto, organizationId: string): Promise<CompanySettings> {
    const settings = await this.get(organizationId);
    Object.assign(settings, dto);
    return this.settingsRepository.save(settings);
  }
}
