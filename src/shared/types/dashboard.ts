import { QuotationStatus } from '../../database/entities/quotation.entity';

export interface IDashboardStats {
  totalQuotations: number;
  statusBreakdown: Record<QuotationStatus, number>;
  totalRevenue: number;
  acceptedRevenue: number;
  acceptanceRate: number;
  conversionRate: number;
  totalCustomers: number;
  totalProducts: number;
  recentQuotations: IDashboardQuotation[];
  monthlyTrend: IMonthlyTrend[];
}

export interface IDashboardQuotation {
  id: string;
  quotationNumber: string;
  title: string;
  customerName: string;
  status: QuotationStatus;
  total: number;
  createdAt: string;
}

export interface IMonthlyTrend {
  month: string;
  count: number;
  total: number;
}
