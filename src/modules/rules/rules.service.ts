import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuleSet, RuleCategory } from '../../database/entities/rule-set.entity';
import { CreateRuleSetDto } from './dto/create-rule-set.dto';
import { UpdateRuleSetDto } from './dto/update-rule-set.dto';

export interface RuleViolation {
  itemIndex: number;
  field: string;
  operator: string;
  value: any;
  actualValue: any;
  action: string;
  actionValue?: any;
  message?: string;
  priority: number;
}

export interface EvaluationResult {
  passed: boolean;
  requiresReview: boolean;
  violations: RuleViolation[];
  modifiedItems: Record<string, any>[];
}

@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(RuleSet)
    private ruleSetRepository: Repository<RuleSet>,
  ) {}

  async create(organizationId: string, dto: CreateRuleSetDto, userId: string) {
    const ruleSet = this.ruleSetRepository.create({
      ...dto,
      organizationId,
      createdBy: userId,
    });
    return this.ruleSetRepository.save(ruleSet);
  }

  async findAll(organizationId: string, category?: RuleCategory) {
    const where: any = { organizationId };
    if (category) where.category = category;
    return this.ruleSetRepository.find({
      where,
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const ruleSet = await this.ruleSetRepository.findOne({
      where: { id, organizationId },
    });
    if (!ruleSet) throw new NotFoundException('Rule set not found');
    return ruleSet;
  }

  async update(id: string, organizationId: string, dto: UpdateRuleSetDto) {
    const ruleSet = await this.findOne(id, organizationId);
    Object.assign(ruleSet, dto);
    return this.ruleSetRepository.save(ruleSet);
  }

  async remove(id: string, organizationId: string) {
    const ruleSet = await this.findOne(id, organizationId);
    return this.ruleSetRepository.remove(ruleSet);
  }

  async evaluate(
    organizationId: string,
    category: RuleCategory,
    items: Record<string, any>[],
    ruleSetId?: string,
  ): Promise<EvaluationResult> {
    let ruleSet: RuleSet | null;

    if (ruleSetId) {
      ruleSet = await this.findOne(ruleSetId, organizationId);
    } else {
      ruleSet = await this.ruleSetRepository.findOne({
        where: { organizationId, category, isActive: true },
      });
    }

    if (!ruleSet) {
      return { passed: true, requiresReview: false, violations: [], modifiedItems: [...items] };
    }

    const violations: RuleViolation[] = [];
    const modifiedItems = items.map((item) => ({ ...item }));

    const sortedRules = [...ruleSet.rules].sort((a, b) => a.priority - b.priority);

    for (let i = 0; i < modifiedItems.length; i++) {
      const item = modifiedItems[i];

      for (const rule of sortedRules) {
        const actualValue = item[rule.field];
        if (actualValue === undefined || actualValue === null) continue;

        const matches = this.evaluateCondition(actualValue, rule.operator, rule.value);

        if (matches) {
          violations.push({
            itemIndex: i,
            field: rule.field,
            operator: rule.operator,
            value: rule.value,
            actualValue,
            action: rule.action,
            actionValue: rule.actionValue,
            message: rule.message,
            priority: rule.priority,
          });

          if (rule.action === 'modify' && rule.actionValue !== undefined) {
            modifiedItems[i] = { ...modifiedItems[i], [rule.field]: rule.actionValue };
          }
        }
      }
    }

    const hasReject = violations.some((v) => v.action === 'reject');
    const hasFlag = violations.some((v) => v.action === 'flag');

    return {
      passed: !hasReject,
      requiresReview: hasFlag || hasReject,
      violations,
      modifiedItems,
    };
  }

  private evaluateCondition(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'neq':
        return actual !== expected;
      case 'gt':
        return Number(actual) > Number(expected);
      case 'gte':
        return Number(actual) >= Number(expected);
      case 'lt':
        return Number(actual) < Number(expected);
      case 'lte':
        return Number(actual) <= Number(expected);
      case 'contains':
        return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case 'startsWith':
        return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());
      default:
        return false;
    }
  }
}
