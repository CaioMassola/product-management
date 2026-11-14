import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { NextRequest } from 'next/server';
import { getPageMetadata } from '@/lib/page-metadata';
import requestConfig from '@/i18n/request';
import proxy from '@/proxy';
import * as navigation from '@/i18n/navigation';
vi.mock('next-intl/middleware', () => ({
  default: () => () => new Response(null, { status: 307 }),
}));
vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
      <a
        href={href}
        {...props}
      >
        {children}
      </a>
    ),
    useRouter: () => ({ replace: vi.fn() }),
    usePathname: () => '/products',
    redirect: mocks.redirect,
  }),
}));
import LocaleLayout, { generateMetadata } from './[locale]/layout';
import Home from './[locale]/page';
import Missing from './[locale]/[...rest]/page';
import NotFound from './[locale]/not-found';
import ErrorPage from './[locale]/error';

const mocks = vi.hoisted(() => ({
  setLocale: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  usePathname: () => '/en/products',
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
  setRequestLocale: mocks.setLocale,
  getRequestConfig: (callback: unknown) => callback,
}));

describe('server routes and metadata', () => {
  it('exports locale-aware navigation and redirects the index', async () => {
    expect(navigation.Link).toBeDefined();
    expect(navigation.useRouter).toBeDefined();
    expect(navigation.usePathname).toBeDefined();
    await Home({ params: Promise.resolve({ locale: 'en' }) });
    expect(mocks.redirect).toHaveBeenCalled();
    expect(proxy(new NextRequest('http://localhost/products')).status).toBe(
      307,
    );
  });
  it.each(['en', 'es', 'pt-BR', undefined, 'fr'])(
    'loads request messages with locale fallback for %s',
    async (locale) => {
      const config = await (
        requestConfig as unknown as (args: {
          requestLocale: Promise<string | undefined>;
        }) => Promise<{ locale: string; messages: unknown }>
      )({ requestLocale: Promise.resolve(locale) });

      expect(config.locale).toBe(
        locale && ['en', 'es', 'pt-BR'].includes(locale) ? locale : 'pt-BR',
      );
      expect(config.messages).toHaveProperty('app');
    },
  );
  it('validates layout locale before translating and renders children', async () => {
    expect(
      await generateMetadata({ params: Promise.resolve({ locale: 'en' }) }),
    ).toMatchObject({ title: { default: 'name' }, description: 'description' });
    await expect(
      generateMetadata({ params: Promise.resolve({ locale: 'fr' }) }),
    ).rejects.toThrow('NOT_FOUND');
    await expect(
      LocaleLayout({
        params: Promise.resolve({ locale: 'fr' }),
        children: 'child',
      }),
    ).rejects.toThrow('NOT_FOUND');

    const layout = await LocaleLayout({
      params: Promise.resolve({ locale: 'en' }),
      children: 'child',
    });

    expect(layout.props.lang).toBe('en');
    expect(mocks.setLocale).toHaveBeenCalledWith('en');
    expect(
      await getPageMetadata(
        Promise.resolve({ locale: 'en' }),
        'products.title',
      ),
    ).toEqual({ title: 'products.title' });
  });
  it('returns friendly localized missing and error screens', async () => {
    expect(() => Missing()).toThrow('NOT_FOUND');
    const reset = vi.fn();
    const missing = await NotFound();
    render(
      <NextIntlClientProvider
        locale="en"
        messages={messages}
      >
        {missing}
        <ErrorPage
          reset={reset}
        />
      </NextIntlClientProvider>,
    );
    screen.getByRole('button').click();
    expect(reset).toHaveBeenCalled();
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
  });
  it('connects every route to its screen and metadata', async () => {
    const routes = [
      await import('./[locale]/products/page'),
      await import('./[locale]/products/new/page'),
      await import('./[locale]/products/[id]/page'),
      await import('./[locale]/products/[id]/edit/page'),
      await import('./[locale]/reports/page'),
      await import('./[locale]/settings/page'),
    ];

    for (const route of routes) {
      const params = Promise.resolve({ locale: 'en', id: 'product-id' });
      expect(await route.generateMetadata({ params })).toHaveProperty('title');
      const page = await route.default({ params });
      expect(page).toBeTruthy();
    }
  });
});
