'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useFormatter, useTranslations } from 'next-intl';
import { Download, X } from 'lucide-react';
import { buttonClass } from '@/components/ui/controls';
import { ErrorState } from '@/components/ui/query-state';
import { useReport } from '../queries';
import { reportDownloadUrl } from '../api';
import type { Report } from '../types';
import { ReportStatusBadge } from './report-status-badge';
import { ReportFilterSummary } from './report-filter-summary';

export function ReportDetailsDialog({
  report,
  close,
  restoreFocus,
}: {
  report: Report;
  close: () => void;
  restoreFocus: () => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const query = useReport(report.id, report);
  const current = query.data ?? report;

  const date = (value: string | null) =>
    value
      ? format.dateTime(new Date(value), {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      : t('reportCenter.notAvailable');

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="dialog-overlay"
        />
        <Dialog.Content
          className="dialog-content report-details-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
        >
          <Dialog.Title
            className="dialog-title"
          >
            {t('reportCenter.details')}
          </Dialog.Title>
          <Dialog.Description
            className="report-details-name"
          >
            {current.filename}
          </Dialog.Description>
          <Dialog.Close
            className="icon-button dialog-close"
            aria-label={t('common.close')}
          >
            <X
              size={18}
            />
          </Dialog.Close>
          <ReportStatusBadge
            status={current.status}
          />
          {query.isError && (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          )}
          <dl
            className="report-details-grid"
          >
            <div>
              <dt>{t('reportCenter.id')}</dt>
              <dd
                className="report-details-id"
              >{current.id}</dd>
            </div>
            <div>
              <dt>{t('reportCenter.requestedAt')}</dt>
              <dd>{date(current.requestedAt)}</dd>
            </div>
            <div>
              <dt>{t('reportCenter.startedAt')}</dt>
              <dd>{date(current.startedAt)}</dd>
            </div>
            <div>
              <dt>{t('reportCenter.completedAt')}</dt>
              <dd>{date(current.completedAt)}</dd>
            </div>
            <div
              className="full-width"
            >
              <dt>{t('reportCenter.filters')}</dt>
              <dd>
                <ReportFilterSummary
                  filters={current.filters}
                />
              </dd>
            </div>
          </dl>
          {current.status === 'FAILED' && (
            <p
              className="notice notice-error"
              role="alert"
            >
              {t('reports.failedHelp')}
            </p>
          )}
          {current.status === 'COMPLETED' && current.downloadAvailable && (
            <div
              className="dialog-actions"
            >
              <a
                className={buttonClass()}
                href={reportDownloadUrl(current.id)}
                download={current.filename}
                target="_blank"
                rel="noreferrer"
              >
                <Download
                  size={16}
                />
                {t('reports.download')}
              </a>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
