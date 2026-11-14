'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Box,
  FileSpreadsheet,
  LayoutGrid,
  Menu,
  Moon,
  Settings2,
  X,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { ThemeToggle } from './theme-toggle';
import { LanguageSelect } from './language-select';

function SidebarContent({ close }: { close?: () => void }) {
  const t = useTranslations();
  const pathname = usePathname();

  return (
    <>
      <Link
        href="/products"
        className="brand"
        onClick={close}
      >
        <span
          className="brand-symbol"
        >
          <Box
            size={24}
            strokeWidth={1.6}
          />
        </span>
        <span>
          <strong>{t('app.brandTop')}</strong>
          <small>{t('app.brandBottom')}</small>
        </span>
      </Link>
      <nav
        aria-label={t('app.menu')}
        className="main-navigation"
      >
        <p
          className="navigation-label"
        >{t('app.menu')}</p>
        <Link
          href="/products"
          onClick={close}
          className={`nav-link ${pathname.startsWith('/products') ? 'active' : ''}`}
          aria-current={pathname.startsWith('/products') ? 'page' : undefined}
        >
          <LayoutGrid
            size={18}
          />
          {t('app.products')}
        </Link>
        <Link
          href="/reports"
          onClick={close}
          className={`nav-link ${pathname.startsWith('/reports') ? 'active' : ''}`}
          aria-current={pathname.startsWith('/reports') ? 'page' : undefined}
        >
          <FileSpreadsheet
            size={18}
          />
          {t('app.reports')}
        </Link>
        <Link
          href="/settings"
          onClick={close}
          className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}
          aria-current={pathname === '/settings' ? 'page' : undefined}
        >
          <Settings2
            size={18}
          />
          {t('app.settings')}
        </Link>
      </nav>
      <div
        className="sidebar-theme"
      >
        <p>
          <Moon
            size={14}
          />
          {t('preferences.darkMode')}
        </p>
        <span
          className="light-only"
        >○ {t('preferences.disabled')}</span>
        <span
          className="dark-only"
        >● {t('preferences.enabled')}</span>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('app');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="app-shell"
    >
      <a
        className="skip-link"
        href="#main-content"
      >
        {t('skip')}
      </a>
      <aside
        className="sidebar"
      >
        <SidebarContent />
      </aside>
      <div
        className="app-content"
      >
        <header
          className="app-header"
        >
          <Dialog.Root
            open={menuOpen}
            onOpenChange={setMenuOpen}
          >
            <Dialog.Trigger
              className="icon-button mobile-menu"
              aria-label={t('openMenu')}
            >
              <Menu
                size={22}
              />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay
                className="dialog-overlay"
              />
              <Dialog.Content
                className="mobile-sidebar"
                aria-describedby={undefined}
              >
                <Dialog.Title
                  className="sr-only"
                >{t('menu')}</Dialog.Title>
                <Dialog.Close
                  className="icon-button mobile-close"
                  aria-label={t('closeMenu')}
                >
                  <X
                    size={20}
                  />
                </Dialog.Close>
                <SidebarContent
                  close={() => setMenuOpen(false)}
                />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <p
            className="header-caption"
          >{t('panel')}</p>
          <div
            className="header-actions"
          >
            <LanguageSelect />
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main-content"
          className="page-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
