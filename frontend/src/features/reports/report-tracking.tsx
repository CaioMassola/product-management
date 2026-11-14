'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  X,
} from 'lucide-react';
import { reportDownloadUrl } from './api';
import { useReport } from './queries';
import type { Report } from './types';
import { Button } from '@/components/ui/controls';
import { errorKey } from '@/lib/api-client';

const STORAGE_KEY = 'product-management.report-ids';
const CHANGE_EVENT = 'product-management:reports';
let fallbackSnapshot = '[]';

function readSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? fallbackSnapshot;
  } catch {
    return fallbackSnapshot;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function parseIds(snapshot: string): string[] {
  try {
    const value: unknown = JSON.parse(snapshot);

    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is string =>
                typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id),
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  fallbackSnapshot = JSON.stringify(ids);
  try {
    window.localStorage.setItem(STORAGE_KEY, fallbackSnapshot);
  } catch {
    /* Continue tracking in this tab if storage is unavailable. */
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useTrackReport() {
  const client = useQueryClient();

  return (report: Report) => {
    client.setQueryData(['report', report.id], report);
    writeIds([...parseIds(readSnapshot()), report.id]);
    void client.invalidateQueries({ queryKey: ['reports'] });
  };
}

function ReportActivityItem({ id }: { id: string }) {
  const t = useTranslations();
  const query = useReport(id);
  const report = query.data;

  const ongoing =
    report?.status === 'PENDING' ||
    report?.status === 'PROCESSING' ||
    query.isPending;

  return (
    <li
      className="report-activity-item"
    >
      <div
        className="report-activity-icon"
        aria-hidden
      >
        {query.isError || report?.status === 'FAILED' ? (
          <AlertCircle
            size={18}
          />
        ) : ongoing ? (
          <LoaderCircle
            size={18}
            className="animate-spin"
          />
        ) : (
          <CheckCircle2
            size={18}
          />
        )}
      </div>
      <div
        className="report-activity-info"
      >
        <p
          className="report-filename"
        >
          {report?.filename ?? t('reports.loading')}
        </p>
        <p
          role="status"
          aria-live="polite"
          className={
            report?.status === 'FAILED' || query.isError
              ? 'field-error'
              : 'muted'
          }
        >
          {query.isError
            ? t(`errors.${errorKey(query.error)}`)
            : report?.status === 'FAILED'
              ? t('reports.failedHelp')
              : report
                ? t(`reportStatus.${report.status}`)
                : t('common.loading')}
        </p>
        {report?.status === 'COMPLETED' && report.downloadAvailable && (
          <a
            className="report-download"
            href={reportDownloadUrl(id)}
            download={report.filename}
            target="_blank"
            rel="noreferrer"
          >
            <Download
              size={14}
            />
            {t('reports.download')}
          </a>
        )}
        {query.isError && (
          <Button
            variant="ghost"
            onClick={() => void query.refetch()}
          >
            {t('common.retry')}
          </Button>
        )}
      </div>
      <button
        className="icon-button"
        aria-label={t('reports.dismiss', { name: report?.filename ?? id })}
        onClick={() =>
          writeIds(
            parseIds(readSnapshot()).filter((existing) => existing !== id),
          )
        }
      >
        <X
          size={15}
        />
      </button>
    </li>
  );
}

export function ReportActivity() {
  const t = useTranslations('reports');
  const pathname = usePathname();
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => '[]');
  const ids = useMemo(() => parseIds(snapshot), [snapshot]);
  if (ids.length === 0) return null;

  return (
    <aside
      className="report-activity"
      hidden={Boolean(pathname?.endsWith('/reports'))}
      aria-label={t('activity')}
    >
      <h2>
        <FileSpreadsheet
          size={17}
        />
        {t('activity')}
      </h2>
      <ul>
        {ids.map((id) => (
          <ReportActivityItem
            key={id}
            id={id}
          />
        ))}
      </ul>
    </aside>
  );
}
