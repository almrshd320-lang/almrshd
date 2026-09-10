'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Accessible dialog.
 *
 * Built on <dialog> so focus trapping, Escape and inertness of the rest of the
 * page come from the platform rather than from a hand-rolled key handler that
 * eventually leaks focus. On mobile it presents as a bottom sheet, which is
 * where a thumb actually reaches.
 */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Light surface, for the admin area. */
  light?: boolean;
}

export function Modal({
  open, onClose, title, description, children, footer, size = 'md', light = false,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // The background must not scroll behind an open sheet.
      document.body.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Escape fires `cancel`; route it through our own close so state stays in sync.
  const handleCancel = useCallback(
    (event: React.SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      onClose();
    },
    [onClose],
  );

  // Clicking the backdrop closes. The check compares against the dialog element
  // itself, which is what receives the click when the backdrop is hit.
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === ref.current) onClose();
    },
    [onClose],
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={ref}
      onCancel={handleCancel}
      onClick={handleClick}
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      className={cn(
        'w-full max-w-[calc(100vw-2rem)] backdrop:bg-black/70 backdrop:backdrop-blur-sm',
        'm-0 mt-auto rounded-t-2xl p-0 sm:m-auto sm:rounded-2xl',
        size === 'sm' && 'sm:max-w-md',
        size === 'md' && 'sm:max-w-lg',
        size === 'lg' && 'sm:max-w-2xl',
        light
          ? 'bg-white text-ink-800 shadow-elevated'
          : 'border border-white/10 bg-ink-800 text-ink-100',
      )}
    >
      <div className="flex max-h-[85dvh] flex-col" dir="rtl">
        <header
          className={cn(
            'flex items-start justify-between gap-4 border-b p-5',
            light ? 'border-ink-200' : 'border-white/8',
          )}
        >
          <div className="space-y-1">
            <h2 id="modal-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p
                id="modal-description"
                className={cn('text-sm leading-relaxed', light ? 'text-ink-500' : 'text-ink-400')}
              >
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-lg transition-colors',
              light ? 'hover:bg-ink-100' : 'hover:bg-white/8',
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <footer
            className={cn(
              'flex flex-col-reverse gap-2 border-t p-5 sm:flex-row sm:justify-start',
              light ? 'border-ink-200' : 'border-white/8',
            )}
          >
            {footer}
          </footer>
        )}
      </div>
    </dialog>,
    document.body,
  );
}
