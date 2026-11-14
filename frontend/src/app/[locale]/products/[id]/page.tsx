import { ProductDetails } from '@/features/products/components/product-details';
import { getPageMetadata } from '@/lib/page-metadata';

export const generateMetadata = ({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) => getPageMetadata(params, 'products.details');

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ProductDetails
    id={(await params).id}
         />;
}
