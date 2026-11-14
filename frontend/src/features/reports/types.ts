import type { ProductStatus, ProductType } from '@/features/products/types';

export type ReportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export const REPORT_STATUSES: ReportStatus[] = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
];
export type ReportFilters = {
  productType?: ProductType;
  productStatus?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
};
export type Report = {
  id: string;
  filename: string;
  status: ReportStatus;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  filters: ReportFilters;
  downloadAvailable: boolean;
  errorMessage: string | null;
};
export type ReportListFilters = {
  name: string;
  status: ReportStatus | '';
  productType: ProductType | '';
  productStatus: ProductStatus | '';
  minPrice: string;
  maxPrice: string;
  requestedFrom: string;
  requestedTo: string;
  page: number;
  size: number;
  sortBy: 'filename' | 'requestedAt' | 'status';
  direction: 'ASC' | 'DESC';
};
export type ReportPage = {
  content: Report[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  activeCount: number;
};
