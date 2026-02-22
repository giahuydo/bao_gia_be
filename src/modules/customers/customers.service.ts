import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../database/entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto, PaginatedResultDto } from '../../shared/dto/pagination.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  async create(createDto: CreateCustomerDto, userId: string): Promise<Customer> {
    const customer = this.customersRepository.create({
      ...createDto,
      createdBy: userId,
    });
    return this.customersRepository.save(customer);
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResultDto<Customer>> {
    const { page, limit, search } = paginationDto;
    const qb = this.customersRepository.createQueryBuilder('customer');

    if (search) {
      qb.where(
        'customer.name ILIKE :search OR customer.email ILIKE :search OR customer.phone ILIKE :search',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('customer.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, page, limit);
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id },
      relations: ['createdByUser'],
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async update(id: string, updateDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    Object.assign(customer, updateDto);
    return this.customersRepository.save(customer);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.customersRepository.softRemove(customer);
  }
}
