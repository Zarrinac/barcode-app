'use client';

import { CalendarMonthOutlined } from '@mui/icons-material';
import { useMemo, useState } from 'react';

import {
  formatPersianDateParts,
  getPersianDateParts,
  getPersianMonthDates,
  getPersianWeekIndex,
  parsePersianDate,
  persianMonthNames,
  persianWeekDays,
  today,
} from '@/components/admin/persian-date';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function PersianDateField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const selectedDate = parsePersianDate(value) ?? getPersianDateParts(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState({
    month: selectedDate.month,
    year: selectedDate.year,
  });
  const monthDates = useMemo(
    () => getPersianMonthDates(visibleMonth.year, visibleMonth.month),
    [visibleMonth.month, visibleMonth.year],
  );
  const leadingCells = monthDates[0] ? getPersianWeekIndex(monthDates[0].date) : 0;
  const selectedValue = formatPersianDateParts(selectedDate);

  const changeMonth = (offset: number) => {
    setVisibleMonth((current) => {
      const zeroBasedMonth = current.month - 1 + offset;
      const year = current.year + Math.floor(zeroBasedMonth / 12);
      const month = ((zeroBasedMonth % 12) + 12) % 12;

      return { year, month: month + 1 };
    });
  };

  return (
    <label className={'relative grid gap-2 md:max-w-80 text-sm font-bold text-app-muted'}>
      <span>{label}</span>
      <button
        className={cx(
          'flex h-11 w-full items-center gap-4 rounded-lg border border-app-line bg-app-surface-soft px-3 text-right font-extrabold text-app-ink outline-none focus:border-dcode-red-500 focus:ring-4 ring-dcode-red-500/10',
          isOpen && 'border-dcode-red-500 ring-4 ring-dcode-red-500/10',
          !value && 'font-bold text-app-muted',
        )}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <CalendarMonthOutlined className={'size-5! text-dcode-red-500'} />
        <span>{value || placeholder || today}</span>
      </button>
      {isOpen && (
        <div
          className={
            'absolute top-[calc(100%+8px)] right-0 z-5 w-[min(330px,88vw)] rounded-2xl border border-app-line bg-linear-to-b from-app-surface to-app-surface-soft p-3.5 shadow-2xl max-smd:w-[min(300px,calc(100vw-52px))]'
          }
        >
          <div className={'mb-3 flex items-center justify-between gap-2.5'}>
            <button
              className={
                'h-8 w-8 rounded-lg border-0 bg-app-line text-2xl font-black text-dcode-900'
              }
              onClick={() => changeMonth(-1)}
              type="button"
            >
              ‹
            </button>
            <strong className={'text-base text-dcode-900'}>
              {persianMonthNames[visibleMonth.month - 1]} {visibleMonth.year}
            </strong>
            <button
              className={
                'h-8 w-8 rounded-lg border-0 bg-app-line text-2xl font-black text-dcode-900'
              }
              onClick={() => changeMonth(1)}
              type="button"
            >
              ›
            </button>
          </div>
          <div className={'grid grid-cols-7 gap-1.5'}>
            {persianWeekDays.map((day) => (
              <span
                className={'grid h-6 place-items-center text-xs font-black text-app-muted'}
                key={day}
              >
                {day}
              </span>
            ))}
          </div>
          <div className={'grid grid-cols-7 gap-1.5'}>
            {Array.from({ length: leadingCells }).map((_, index) => (
              <span className={'h-8'} key={`empty-${index}`} />
            ))}
            {monthDates.map(({ parts }) => {
              const dateValue = formatPersianDateParts(parts);

              return (
                <button
                  className={cx(
                    'grid h-8 place-items-center rounded-lg border-0 bg-app-line font-black text-dcode-900 hover:bg-dcode-red-500 hover:text-white',
                    dateValue === selectedValue && 'bg-dcode-red-500 text-white',
                  )}
                  key={dateValue}
                  onClick={() => {
                    onChange(dateValue);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  {parts.day.toLocaleString('fa-IR')}
                </button>
              );
            })}
          </div>
          <button
            className={
              'mt-3 h-9 w-full rounded-lg border-0 bg-dcode-red-100 font-black text-dcode-red-700'
            }
            onClick={() => {
              const now = getPersianDateParts(new Date());
              setVisibleMonth({ year: now.year, month: now.month });
              onChange(formatPersianDateParts(now));
              setIsOpen(false);
            }}
            type="button"
          >
            امروز
          </button>
        </div>
      )}
    </label>
  );
}
