'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { useTranslations } from 'next-intl';
import { ReportActivity } from '@/features/reports/report-tracking';

function Notifications() {
  const { resolvedTheme } = useTheme();
  const t = useTranslations('common');

  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      richColors
      closeButton
      toastOptions={{ closeButtonAriaLabel: t('close') }}
      containerAriaLabel={t('notifications')}
    />
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider
        client={client}
      >
        {children}
        <ReportActivity />
        <Notifications />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
