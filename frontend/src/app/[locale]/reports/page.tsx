import { ReportCenter } from '@/features/reports/components/report-center';
import { getPageMetadata } from '@/lib/page-metadata';

export const generateMetadata = ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) => getPageMetadata(params, 'reportCenter.title');

export default function ReportsPage() {
  return <ReportCenter />;
}
