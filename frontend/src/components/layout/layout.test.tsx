import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import messages from '@/messages/en.json';
import { AppShell } from './app-shell';
import { Preferences } from './preferences';
import { AppProviders } from '@/providers/app-providers';

const navigation = vi.hoisted(() => ({ path: '/products', replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a
      href={href}
      {...props}
    >
      {children}
    </a>
  ),
  usePathname: () => navigation.path,
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock('@/features/reports/report-tracking', () => ({
  ReportActivity: () => null,
}));

function wrap(children: React.ReactNode) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="UTC"
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
      >
        {children}
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

describe('navigation and preferences', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });
  it.each(['/products', '/reports', '/settings'])(
    'marks the current page and closes the mobile menu at %s',
    async (path) => {
      navigation.path = path;
      const user = userEvent.setup();
      render(wrap(<AppShell>Content</AppShell>));
      expect(document.querySelector('a[aria-current="page"]')).toHaveAttribute(
        'href',
        path,
      );
      await user.click(
        screen.getByRole('button', { name: messages.app.openMenu }),
      );
      const dialog = screen.getByRole('dialog');
      await user.click(
        within(dialog).getByRole('link', { name: messages.app.reports }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveTextContent('Content');
    },
  );
  it('preserves query parameters when switching the header language and toggles both themes', async () => {
    navigation.path = '/products';
    window.history.replaceState({}, '', '/products?search=chair');
    const user = userEvent.setup();
    render(wrap(<AppShell>Content</AppShell>));
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: messages.preferences.selectLanguage,
      }),
      'es',
    );
    expect(navigation.replace).toHaveBeenCalledWith('/products?search=chair', {
      locale: 'es',
    });
    await user.click(
      screen.getByRole('button', { name: messages.preferences.switchTheme }),
    );
    expect(document.documentElement).toHaveClass('dark');
    await user.click(
      screen.getByRole('button', { name: messages.preferences.switchTheme }),
    );
    expect(document.documentElement).toHaveClass('light');
  });
  it('switches settings language and explicitly selects dark and light', async () => {
    const user = userEvent.setup();
    render(wrap(<Preferences />));
    await user.click(screen.getByRole('radio', { name: /Español/ }));
    expect(navigation.replace).toHaveBeenCalledWith('/settings', {
      locale: 'es',
    });
    await user.click(
      screen.getByRole('button', { name: messages.preferences.dark }),
    );
    expect(
      screen.getByRole('button', { name: messages.preferences.dark }),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.click(
      screen.getByRole('button', { name: messages.preferences.light }),
    );
    expect(
      screen.getByRole('button', { name: messages.preferences.light }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
  it('renders server preferences without claiming a selected theme before hydration', () => {
    expect(renderToString(wrap(<Preferences />))).toContain(
      'aria-pressed="false"',
    );
  });
  it.each(['dark', 'light'])(
    'mounts application providers and localized notifications in %s mode',
    (theme) => {
      window.localStorage.setItem('theme', theme);
      render(
        <NextIntlClientProvider
          locale="en"
          messages={messages}
        >
          <AppProviders>
            <p>Application</p>
          </AppProviders>
        </NextIntlClientProvider>,
      );
      expect(screen.getByText('Application')).toBeInTheDocument();
    },
  );
});
