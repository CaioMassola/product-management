import { getTranslations } from 'next-intl/server';
import { FileSearch } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buttonClass } from '@/components/ui/controls';

export default async function NotFound() {
  const t = await getTranslations();

  return (
    <section
      className="panel query-state"
    >
      <FileSearch
        size={38}
        aria-hidden
      />
      <h1>{t('navigationErrors.notFound')}</h1>
      <p>{t('navigationErrors.notFoundHelp')}</p>
      <Link
        href="/products"
        className={buttonClass()}
      >
        {t('navigationErrors.backToProducts')}
      </Link>
    </section>
  );
}
