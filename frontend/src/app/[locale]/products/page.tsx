import { ProductList } from '@/features/products/components/product-list';
import { getPageMetadata } from '@/lib/page-metadata';

export const generateMetadata = ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) => getPageMetadata(params, 'products.title');

export default function ProductsPage() {
  return <ProductList />;
}
