import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../database/entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { PaginatedResultDto } from '../../shared/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async create(createDto: CreateProductDto, userId: string, organizationId: string): Promise<Product> {
    const product = this.productsRepository.create({
      ...createDto,
      createdBy: userId,
      organizationId,
    });
    return this.productsRepository.save(product);
  }

  async findAll(queryDto: ProductQueryDto, organizationId: string): Promise<PaginatedResultDto<Product>> {
    const { page, limit, search, category } = queryDto;
    const qb = this.productsRepository.createQueryBuilder('product');

    qb.where('product.organizationId = :organizationId', { organizationId });

    if (search) {
      qb.andWhere('product.name ILIKE :search', { search: `%${search}%` });
    }

    if (category) {
      qb.andWhere('product.category = :category', { category });
    }

    qb.andWhere('product.isActive = :isActive', { isActive: true });
    qb.orderBy('product.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, page, limit);
  }

  async findOne(id: string, organizationId?: string): Promise<Product> {
    const where: any = { id };
    if (organizationId) where.organizationId = organizationId;
    const product = await this.productsRepository.findOne({
      where,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(id: string, updateDto: UpdateProductDto, organizationId: string): Promise<Product> {
    const product = await this.findOne(id, organizationId);
    Object.assign(product, updateDto);
    return this.productsRepository.save(product);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const product = await this.findOne(id, organizationId);
    await this.productsRepository.remove(product);
  }
}
