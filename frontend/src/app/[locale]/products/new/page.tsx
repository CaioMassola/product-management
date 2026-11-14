import { ProductEditor } from '@/features/products/components/product-editor';
import { getPageMetadata } from '@/lib/page-metadata';

export const generateMetadata = ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) => getPageMetadata(params, 'form.newTitle');

export default function NewProductPage() {
  return <ProductEditor />;
}
