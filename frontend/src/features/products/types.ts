export const PRODUCT_TYPES = [
  'ELECTRONICS',
  'FURNITURE',
  'GAMES',
  'COMPUTING',
  'APPLIANCES',
  'CLOTHING',
  'BOOKS',
  'SPORTS',
  'BEAUTY',
  'HOME_AND_DECOR',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export type ProductStatus = 'ACTIVE' | 'INACTIVE';
export type Product = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  price: number;
  quantity: number;
  productType: ProductType;
  status: ProductStatus;
  imageKey: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ProductInput = Pick<
  Product,
  'code' | 'title' | 'description' | 'price' | 'quantity' | 'productType'
>;
export type ProductFilters = {
  search: string;
  productType: ProductType | '';
  status: ProductStatus | 'ALL';
  minPrice: string;
  maxPrice: string;
  page: number;
  size: number;
  sortBy:
    | 'title'
    | 'code'
    | 'price'
    | 'quantity'
    | 'productType'
    | 'status'
    | 'createdAt';
  direction: 'ASC' | 'DESC';
};
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
