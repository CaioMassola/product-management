import { Preferences } from '@/components/layout/preferences';
import { getPageMetadata } from '@/lib/page-metadata';

export const generateMetadata = ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) => getPageMetadata(params, 'preferences.title');

export default function SettingsPage() {
  return <Preferences />;
}
