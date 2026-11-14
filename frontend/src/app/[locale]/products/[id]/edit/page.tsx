import { ProductEditor } from '@/features/products/components/product-editor';
import { getPageMetadata } from '@/lib/page-metadata';

export const generateMetadata = ({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) => getPageMetadata(params, 'form.editTitle');

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ProductEditor
    id={(await params).id}
         />;
}
