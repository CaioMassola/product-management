import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getReport, listReports } from './api';
import type { Report, ReportListFilters } from './types';

export function useReports(filters: ReportListFilters, enabled = true) {
  return useQuery({
    queryKey: ['reports', filters],
    queryFn: ({ signal }) => listReports(filters, signal),
    enabled,
    refetchInterval: (query) =>
      query.state.status !== 'error' && (query.state.data?.activeCount ?? 0) > 0
        ? 3000
        : false,
  });
}

export function useReport(id: string, initialData?: Report) {
  const client = useQueryClient();

  const query = useQuery({
    queryKey: ['report', id],
    queryFn: ({ signal }) => getReport(id, signal),
    initialData,
    staleTime: initialData ? 0 : Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.status === 'error'
        ? false
        : query.state.data &&
            ['COMPLETED', 'FAILED'].includes(query.state.data.status)
          ? false
          : 3000,
  });

  const status = query.data?.status;
  const previousStatus = useRef(status);
  useEffect(() => {
    if (
      previousStatus.current &&
      previousStatus.current !== status &&
      (status === 'COMPLETED' || status === 'FAILED')
    ) {
      void client.invalidateQueries({ queryKey: ['reports'] });
    }

    previousStatus.current = status;
  }, [client, status]);

  return query;
}
