'use client';

import { Add, Download, Search, Upload } from '@mui/icons-material';
import type { ReactNode, Ref } from 'react';

const pageSizeOptions = [20, 50, 100];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className={
        'fixed inset-0 z-50 grid place-items-center bg-dcode-900/65 p-6 backdrop-blur-[10px] max-smd:items-start max-smd:overflow-auto max-smd:p-2.5 max-xs:p-2'
      }
      role="presentation"
    >
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className={cx(
          'max-h-[min(860px,calc(100vh-44px))] w-[min(560px,100%)] overflow-auto rounded-3xl border border-white/70 bg-linear-to-b from-app-surface to-app-surface-soft shadow-dcode-modal max-smd:max-h-none max-smd:w-full max-smd:rounded-2xl',
          wide && 'w-[min(860px,100%)]',
        )}
        role="dialog"
      >
        <div
          className={
            'sticky top-0 z-1 flex items-start justify-between gap-3.5 border-b border-app-line bg-linear-to-b from-app-surface to-app-surface-soft px-6 py-6 max-smd:gap-2.5 max-smd:px-4 max-smd:py-4 max-xs:px-3.5'
          }
        >
          <div>
            <h2
              className={
                'm-0 text-2xl font-black text-dcode-900 max-smd:text-2xl max-smd:leading-tight'
              }
              id="modal-title"
            >
              {title}
            </h2>
            <p
              className={
                'mt-2 text-sm font-bold text-app-muted max-smd:text-xs max-smd:leading-[1.8]'
              }
            >
              {subtitle}
            </p>
          </div>
          <button
            className={
              'h-10 w-10 rounded-xl border-0 bg-app-line text-2xl leading-none text-dcode-900 max-smd:h-9 max-smd:w-9'
            }
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ModalActions({
  confirmLabel,
  onCancel,
}: {
  confirmLabel: string;
  onCancel: () => void;
}) {
  return (
    <div
      className={
        'col-span-full mt-2 flex items-center justify-start gap-2.5 max-smd:flex-col-reverse max-smd:items-stretch'
      }
    >
      <button
        className={cx(
          'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
          'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
        )}
        onClick={onCancel}
        type="button"
      >
        انصراف
      </button>
      <button
        className={cx(
          'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
          'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
        )}
        type="submit"
      >
        <Add />
        {confirmLabel}
      </button>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputRef,
  wide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputRef?: Ref<HTMLInputElement>;
  wide?: boolean;
}) {
  return (
    <label className={cx('grid gap-2 text-sm font-bold text-app-muted', wide && 'col-span-full')}>
      <span>{label}</span>
      <input
        className={
          'h-11 w-full rounded-lg border border-app-line bg-app-surface-soft px-3 text-app-ink outline-none transition focus:border-dcode-red-500 focus:ring-4 ring-dcode-red-500/10'
        }
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function ContentPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={
        'min-h-130 rounded-2xl border border-dcode-900/10 bg-app-surface p-6 shadow-dcode-panel max-smd:min-h-0 max-smd:min-w-0 max-smd:rounded-2xl max-smd:p-4 max-xs:p-3.5'
      }
    >
      <div
        className={
          'mb-6 flex items-start justify-between gap-4 max-smd:mb-4 max-smd:flex-col max-smd:items-stretch max-smd:gap-3'
        }
      >
        <div>
          <h1
            className={
              'm-0 text-3xl smd:text-4xl font-black text-dcode-900 max-smd:text-2xl max-smd:leading-tight'
            }
          >
            {title}
          </h1>
          <p className={'mt-2 text-app-muted max-smd:text-sm'}>{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article
      className={
        'min-h-24 rounded-2xl border border-dcode-900/10 border-t-4 border-t-dcode-red-500 bg-app-surface p-4 shadow-dcode-soft max-smd:min-h-20 max-smd:px-3.5 max-smd:py-3'
      }
      data-tone={tone}
    >
      <span className={'block text-sm text-app-muted'}>{label}</span>
      <strong className={'mt-2 block text-3xl leading-none font-black max-smd:text-2xl'}>
        {value.toLocaleString('fa-IR')}
      </strong>
    </article>
  );
}

export function Toolbar({
  search,
  onSearch,
  onExport,
  exportLabel = 'فایل CSV',
  placeholder = 'جستجو...',
}: {
  search: string;
  onSearch: (value: string) => void;
  onExport: () => void;
  exportLabel?: string;
  placeholder?: string;
}) {
  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row md:items-start">
      <div className="flex gap-2 max-md:w-full">
        <button
          className={cx(
            'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-bold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
            'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
            'max-md:w-full',
          )}
          type="button"
        >
          <Upload />
          کپی
        </button>
        <button
          className={cx(
            'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-bold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
            'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
            'max-md:w-full',
          )}
          onClick={onExport}
          type="button"
        >
          <Download />
          {exportLabel}
        </button>
      </div>
      <label
        className={
          'relative grid min-w-75 gap-2 text-sm font-bold text-app-muted max-smd:min-w-0 max-md:w-full'
        }
      >
        <Search className={'absolute right-3 bottom-3 size-5! text-app-muted'} />
        <input
          className={
            'h-11 w-full rounded-lg border border-app-line bg-app-surface-soft px-3 pr-10 text-app-ink outline-none focus:border-dcode-red-500 focus:ring-4 ring-dcode-red-500/10'
          }
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
        />
      </label>
    </div>
  );
}

export function StatusPill({ children, tone }: { children: ReactNode; tone: 'green' | 'orange' }) {
  return (
    <span
      className={cx(
        'inline-flex h-8 min-w-19.5 items-center justify-center rounded-full text-xs font-black text-white',
        tone === 'green'
          ? 'bg-linear-to-br from-dcode-red-500 to-dcode-red-700'
          : 'bg-linear-to-br from-dcode-gold-600 to-dcode-gold-700',
      )}
    >
      {children}
    </span>
  );
}

export function RecordField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      className={
        'flex min-h-8 items-center justify-between gap-3 border-b border-app-line/60 py-2 last:border-b-0'
      }
    >
      <span className={'text-xs font-extrabold text-app-muted'}>{label}</span>
      <strong
        className={
          'min-w-0 text-left text-sm font-extrabold text-slate-700 wrap-anywhere [unicode-bidi:plaintext]'
        }
      >
        {value}
      </strong>
    </div>
  );
}

export function PageSizeControl({
  onPageSizeChange,
  pageSize,
}: {
  onPageSizeChange: (pageSize: number) => void;
  pageSize: number;
}) {
  return (
    <label className={'flex items-center gap-2 max-smd:w-full'}>
      <span className={'whitespace-nowrap'}>ردیف در هر صفحه</span>
      <select
        className={
          'h-9 min-w-19 rounded-lg border border-app-line bg-app-surface-soft px-2.5 font-black text-app-ink'
        }
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
      >
        {pageSizeOptions.map((option) => (
          <option key={option} value={option}>
            {option.toLocaleString('fa-IR')}
          </option>
        ))}
      </select>
    </label>
  );
}

function getPaginationItems(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => totalPages - index);
  }

  const visiblePages = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = Array.from(visiblePages)
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => b - a);

  return pages.flatMap((item, index) => {
    const nextItem = pages[index + 1];

    if (nextItem === 1 && item - nextItem > 1) {
      return [item, 'ellipsis' as const];
    }

    return [item];
  });
}

export function PaginationSummary({
  filteredTotal,
  onPageChange,
  page,
  pageSize,
  total,
}: {
  filteredTotal: number;
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const start = filteredTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(filteredTotal, page * pageSize);
  const hasFiltered = filteredTotal !== total;
  const paginationItems = getPaginationItems(page, totalPages);

  return (
    <div
      className={
        'mt-4 flex items-center justify-between gap-4 font-bold text-app-muted max-smd:flex-col max-smd:items-stretch'
      }
    >
      <span className={'text-center max-smd:text-right'}>
        نمایش {start.toLocaleString('fa-IR')} تا {end.toLocaleString('fa-IR')} از{' '}
        {filteredTotal.toLocaleString('fa-IR')} ردیف
        {hasFiltered ? ` (کل: ${total.toLocaleString('fa-IR')})` : ''}
      </span>
      <div
        className={
          'flex flex-wrap items-center justify-end gap-2 [direction:ltr] max-smd:justify-center'
        }
      >
        <button
          className={
            'h-8 min-w-8 rounded-md border-0 bg-transparent font-extrabold text-app-muted disabled:cursor-not-allowed disabled:opacity-45'
          }
          aria-label="صفحه بعدی"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          {'<'}
        </button>
        {paginationItems.map((item, index) =>
          item === 'ellipsis' ? (
            <span
              className={
                'inline-flex h-8 min-w-6 items-center justify-center font-black text-app-muted'
              }
              key={`ellipsis-${index}`}
            >
              ...
            </span>
          ) : (
            <button
              aria-current={item === page ? 'page' : undefined}
              className={cx(
                'h-8 min-w-8 rounded-md border-0 bg-transparent font-extrabold text-app-muted disabled:cursor-not-allowed disabled:opacity-45',
                item === page
                  ? 'min-w-9 bg-dcode-red-100 px-2.5 text-dcode-red-700'
                  : 'min-w-9 bg-app-line px-2.5',
              )}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              {item.toLocaleString('fa-IR')}
            </button>
          ),
        )}
        <button
          className={
            'h-8 min-w-8 rounded-md border-0 bg-transparent font-extrabold text-app-muted disabled:cursor-not-allowed disabled:opacity-45'
          }
          aria-label="صفحه قبلی"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          {'>'}
        </button>
      </div>
    </div>
  );
}
