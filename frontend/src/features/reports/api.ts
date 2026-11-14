import { API_URL, apiRequest } from '@/lib/api-client';
import type {
  Report,
  ReportFilters,
  ReportListFilters,
  ReportPage,
} from './types';

export const requestReport = (filters: ReportFilters) =>
  apiRequest<Report>('/reports', {
    method: 'POST',
    body: JSON.stringify(filters),
  });
export const getReport = (id: string, signal?: AbortSignal) =>
  apiRequest<Report>(`/reports/${id}`, { signal });
export const reportDownloadUrl = (id: string) =>
  `${API_URL}/reports/${id}/download`;
export function listReports(filters: ReportListFilters, signal?: AbortSignal) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== '') query.set(key, String(value));

  return apiRequest<ReportPage>(`/reports?${query}`, { signal });
}
