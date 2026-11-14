'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button, buttonClass } from './controls';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  error?: string;
}) {
  const t = useTranslations('common');
  const previousFocus = useRef<HTMLElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement | null>(null);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="dialog-overlay"
        />
        <Dialog.Content
          className="dialog-content"
          onOpenAutoFocus={(event) => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            event.preventDefault();
            cancelButton.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (previousFocus.current?.isConnected)
              previousFocus.current.focus();
            else document.getElementById('main-content')?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <Dialog.Title
            className="dialog-title"
          >{title}</Dialog.Title>
          <Dialog.Description
            className="dialog-description"
          >
            {description}
          </Dialog.Description>
          <Dialog.Close
            className="icon-button dialog-close"
            aria-label={t('close')}
            disabled={busy}
          >
            <X
              size={18}
            />
          </Dialog.Close>
          {error && (
            <p
              className="notice notice-error"
              role="alert"
            >
              {error}
            </p>
          )}
          <div
            className="dialog-actions"
          >
            <button
              ref={cancelButton}
              type="button"
              className={buttonClass('secondary')}
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </button>
            <Button
              variant="danger"
              busy={busy}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
