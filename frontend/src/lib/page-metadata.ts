import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type PageTitle =
  | 'products.title'
  | 'products.details'
  | 'form.newTitle'
  | 'form.editTitle'
  | 'reportCenter.title'
  | 'preferences.title';

export async function getPageMetadata(
  params: Promise<{ locale: string }>,
  key: PageTitle,
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return { title: t(key) };
}
