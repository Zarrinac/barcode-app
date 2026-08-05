'use client';

import { Close, Delete, Home, Key, Person, QrCodeScanner, Save, Send } from '@mui/icons-material';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AcPart,
  AuthUser,
  DuplicateSerialsResponse,
  LocationsResponse,
  LoginResponse,
  ProductModel,
  ProductModelsResponse,
  ScannerStep,
  ScannerToast,
  ScanRow,
  SessionResponse,
} from '@/components/scanner/scanner-types';
import {
  apiRequest,
  formatPersianDate,
  getDefaultStatusMessage,
  isInternalWarehouseName,
  normalizeNumberInput,
  normalizeScan,
  readCachedInternalWarehouses,
  readCachedProductModels,
  scannerStorageKey,
  scannerSuccessToastMs,
  scannerToastMs,
  writeCachedInternalWarehouses,
  writeCachedProductModels,
} from '@/components/scanner/scanner-utils';
import { APP_VERSION } from '@/lib/app-info';
import { ensureSerialExcelFolder, saveSerialExcelFile } from '@/lib/serial-excel';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function isRealTrackingCode(value: string) {
  return value.trim().toLowerCase() !== 'panel';
}

function getDuplicateRowsMessage(rows: ScanRow[]) {
  const serialNos = new Set<string>();
  const trackingCodes = new Set<string>();

  for (const row of rows) {
    if (serialNos.has(row.serialNo)) {
      return `شماره سریال ${row.serialNo} در همین سند تکراری است.`;
    }

    serialNos.add(row.serialNo);

    if (!isRealTrackingCode(row.trackingCode)) {
      continue;
    }

    if (trackingCodes.has(row.trackingCode)) {
      return `کد رهگیری ${row.trackingCode} در همین سند تکراری است.`;
    }

    trackingCodes.add(row.trackingCode);
  }

  return null;
}

export default function ScannerPage() {
  const [step, setStep] = useState<ScannerStep>('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [date, setDate] = useState(formatPersianDate(new Date()));
  const [documentNo, setDocumentNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [acPart, setAcPart] = useState<AcPart>(null);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [internalWarehouses, setInternalWarehouses] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [statusMessage, setStatusMessage] = useState('نام کاربری و رمز عبور را وارد کنید.');
  const [statusTone, setStatusTone] = useState<'default' | 'error'>('default');
  const [toast, setToast] = useState<ScannerToast | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);
  const serialInputRef = useRef<HTMLInputElement>(null);

  const goToStep = useCallback((nextStep: ScannerStep, options?: { keepToast?: boolean }) => {
    if (!options?.keepToast) {
      setToast(null);
    }
    setStep(nextStep);
    setStatusMessage(getDefaultStatusMessage(nextStep));
    setStatusTone('default');
  }, []);

  const modelByProductCode = useMemo(() => {
    return new Map(models.map((model) => [model.productCode, model]));
  }, [models]);

  const currentModel = modelByProductCode.get(productCode);
  // Shipping to one of our own warehouses is an internal transfer: the goods leave this building
  // but not the company, so the destination warehouse still has to be able to scan the real exit
  // later. The server reaches the same verdict from the customer name — this only tells the
  // operator which of the two they are recording.
  const isInternalTransfer = isInternalWarehouseName(internalWarehouses, customerName);

  useEffect(() => {
    if (step === 'login') {
      return;
    }

    window.localStorage.setItem(
      scannerStorageKey,
      JSON.stringify({ customerName, date, documentNo, productCode, rows, step }),
    );
  }, [customerName, date, documentNo, productCode, rows, step]);

  useEffect(() => {
    void ensureSerialExcelFolder();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadSession() {
      const shouldForceLogin =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('freshLogin') === '1';

      if (shouldForceLogin) {
        await fetch('/api/logout', { method: 'POST' }).catch(() => undefined);
        window.localStorage.removeItem('barcode-app-login');
        window.localStorage.removeItem(scannerStorageKey);
        window.history.replaceState(null, '', '/scanner');

        if (!isCancelled) {
          setRows([]);
          setProductCode('');
          setTrackingCode('');
          setSerialNo('');
          setDocumentNo('');
          setCustomerName('');
          setCurrentUser(null);
          goToStep('login');
        }

        return;
      }

      try {
        const session = await apiRequest<SessionResponse>('/api/session');

        if (isCancelled) {
          return;
        }

        if (!session.authenticated) {
          setCurrentUser(null);
          setStatusMessage('نام کاربری و رمز عبور را وارد کنید.');
          setStatusTone('default');
          return;
        }

        setCurrentUser(session.user);
        setDate(formatPersianDate(new Date()));
        goToStep('document');
      } catch {
        if (!isCancelled) {
          setCurrentUser(null);
          setStatusMessage('نام کاربری و رمز عبور را وارد کنید.');
          setStatusTone('default');
        }
      }
    }

    void loadSession();

    return () => {
      isCancelled = true;
    };
  }, [goToStep]);

  useEffect(() => {
    if (step !== 'collect') {
      return;
    }

    apiRequest<ProductModelsResponse>('/api/product-models')
      .then((data) => {
        setModels(data.models);
        writeCachedProductModels(data.models);
      })
      .catch(() => {
        // Falling back to the last downloaded list keeps model names on an offline batch, which is
        // the only kind that ends up in an Excel backup.
        const cached = readCachedProductModels();

        if (cached.length > 0) {
          setModels(cached);
          return;
        }

        setStatusMessage('لیست مدل کالا دریافت نشد.');
        setStatusTone('error');
      });
  }, [step]);

  useEffect(() => {
    if (step === 'login') {
      return;
    }

    apiRequest<LocationsResponse>('/api/locations')
      .then((data) => {
        const names = data.locations
          .filter((location) => location.isInternal && location.isActive)
          .map((location) => location.name);

        setInternalWarehouses(names);
        writeCachedInternalWarehouses(names);
      })
      .catch(() => {
        // Offline, the last downloaded list is what lets the operator pick the exact warehouse
        // name — a typed near-miss would land in the Excel backup as an ordinary customer and
        // import as a real exit.
        const cached = readCachedInternalWarehouses();

        if (cached.length > 0) {
          setInternalWarehouses(cached);
        }
      });
  }, [step]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), scannerToastMs);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (step === 'document') {
      window.requestAnimationFrame(() => documentInputRef.current?.focus());
    }

    if (step === 'collect') {
      window.requestAnimationFrame(() => productInputRef.current?.focus());
    }
  }, [step]);

  const showToast = useCallback((message: string, tone: ScannerToast['tone']) => {
    setToast({ message, tone });
    setStatusMessage(message);
    setStatusTone(tone === 'error' ? 'error' : 'default');
  }, []);

  const addRow = useCallback(
    (draft?: Partial<Pick<ScanRow, 'productCode' | 'serialNo' | 'trackingCode'>>) => {
      const cleanProductCode = normalizeNumberInput(draft?.productCode ?? productCode);
      const cleanTrackingCode =
        acPart === 'panel' ? 'panel' : normalizeNumberInput(draft?.trackingCode ?? trackingCode);
      const cleanSerialNo = normalizeScan(draft?.serialNo ?? serialNo);

      if (!cleanProductCode || !cleanTrackingCode || !cleanSerialNo) {
        return;
      }

      if (rows.some((row) => row.serialNo === cleanSerialNo)) {
        showToast(`شماره سریال ${cleanSerialNo} در همین سند تکراری است.`, 'error');
        setSerialNo('');
        window.requestAnimationFrame(() => serialInputRef.current?.focus());
        return;
      }

      if (
        isRealTrackingCode(cleanTrackingCode) &&
        rows.some((row) => row.trackingCode === cleanTrackingCode)
      ) {
        showToast(`کد رهگیری ${cleanTrackingCode} در همین سند تکراری است.`, 'error');
        setTrackingCode('');
        setSerialNo('');
        window.requestAnimationFrame(() => trackingInputRef.current?.focus());
        return;
      }

      const model = modelByProductCode.get(cleanProductCode);

      setRows((current) => [
        {
          id: `${Date.now()}-${cleanSerialNo}`,
          customerName,
          date,
          documentNo,
          model: model?.model || '',
          partType: acPart,
          productCode: cleanProductCode,
          serialNo: cleanSerialNo,
          trackingCode: cleanTrackingCode,
        },
        ...current,
      ]);
      setTrackingCode(acPart === 'panel' ? 'panel' : '');
      setSerialNo('');
      window.requestAnimationFrame(() =>
        (acPart === 'panel' ? serialInputRef.current : trackingInputRef.current)?.focus(),
      );
    },
    [
      acPart,
      customerName,
      date,
      documentNo,
      modelByProductCode,
      productCode,
      rows,
      serialNo,
      showToast,
      trackingCode,
    ],
  );

  const login = async (
    event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
  ) => {
    event?.preventDefault();
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setStatusMessage('نام کاربری و رمز عبور را وارد کنید.');
      setStatusTone('error');
      return;
    }

    setIsLoggingIn(true);

    try {
      const data = await apiRequest<LoginResponse>('/api/login', {
        body: JSON.stringify(loginForm),
        method: 'POST',
      });
      window.localStorage.setItem('barcode-app-login', JSON.stringify(true));
      setCurrentUser(data.user);
      setDate(formatPersianDate(new Date()));
      goToStep('document');
    } catch (error) {
      window.localStorage.removeItem('barcode-app-login');
      setStatusMessage(error instanceof Error ? error.message : 'ورود ناموفق بود.');
      setStatusTone('error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const startCollection = (
    event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
  ) => {
    event?.preventDefault();
    if (!documentNo.trim() || !customerName.trim()) {
      setStatusMessage('شماره سند و نام مشتری را وارد کنید.');
      setStatusTone('error');
      return;
    }

    goToStep('collect');
  };

  const handleScanEnter = (
    event: React.KeyboardEvent<HTMLInputElement>,
    next: React.RefObject<HTMLInputElement | null> | 'add',
  ) => {
    const isCommitKey =
      event.key === 'Enter' ||
      event.key === 'NumpadEnter' ||
      event.key === 'Tab' ||
      event.code === 'Enter' ||
      event.code === 'NumpadEnter' ||
      event.code === 'Tab' ||
      event.keyCode === 13 ||
      event.keyCode === 9;

    if (!isCommitKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (next === 'add') {
      addRow({
        productCode: productInputRef.current?.value,
        serialNo: event.currentTarget.value,
        trackingCode: trackingInputRef.current?.value,
      });
      return;
    }

    if (next === trackingInputRef) {
      setProductCode(normalizeNumberInput(event.currentTarget.value));
    }

    if (next === serialInputRef && acPart !== 'panel') {
      setTrackingCode(normalizeNumberInput(event.currentTarget.value));
    }

    window.setTimeout(() => next.current?.focus(), 0);
  };

  const clearProductForNewModel = () => {
    if (!productCode) {
      return;
    }

    setProductCode('');
    setTrackingCode(acPart === 'panel' ? 'panel' : '');
    setSerialNo('');
    window.requestAnimationFrame(() => productInputRef.current?.focus());
  };

  const selectAcPart = (part: Exclude<AcPart, null>) => {
    const nextPart = acPart === part ? null : part;

    setAcPart(nextPart);

    if (nextPart === 'panel') {
      setTrackingCode('panel');
      window.requestAnimationFrame(() => serialInputRef.current?.focus());
      return;
    }

    if (trackingCode === 'panel') {
      setTrackingCode('');
    }
    window.requestAnimationFrame(() => trackingInputRef.current?.focus());
  };

  const finishSuccessfulBatch = (message: string) => {
    setIsCompleting(true);
    showToast(message, 'success');

    window.setTimeout(() => {
      setRows([]);
      setProductCode('');
      setTrackingCode('');
      setSerialNo('');
      setAcPart(null);
      setDocumentNo('');
      setCustomerName('');
      setDate(formatPersianDate(new Date()));
      goToStep('document', { keepToast: true });
      setIsCompleting(false);
      window.localStorage.removeItem(scannerStorageKey);
    }, scannerSuccessToastMs);
  };

  const sendRows = async () => {
    if (rows.length === 0 || isSending || isCompleting) {
      return;
    }

    const localDuplicateMessage = getDuplicateRowsMessage(rows);

    if (localDuplicateMessage) {
      showToast(localDuplicateMessage, 'error');
      return;
    }

    setIsSending(true);
    try {
      const duplicates = await apiRequest<DuplicateSerialsResponse>(
        '/api/serial-records/duplicates',
        {
          body: JSON.stringify({
            // The destination scopes the check: a serial that has only ever moved between our own
            // warehouses is not a duplicate for the warehouse now shipping it to a customer.
            customerName,
            serialNos: rows.map((row) => row.serialNo),
            trackingCodes: rows
              .map((row) => row.trackingCode)
              .filter((code) => isRealTrackingCode(code)),
          }),
          method: 'POST',
        },
      );

      if (duplicates.serialNos.length > 0) {
        showToast(`شماره سریال ${duplicates.serialNos[0]} قبلا در دیتابیس ثبت شده است.`, 'error');
        return;
      }

      if (duplicates.trackingCodes.length > 0) {
        showToast(`کد رهگیری ${duplicates.trackingCodes[0]} قبلا در دیتابیس ثبت شده است.`, 'error');
        return;
      }

      for (const row of [...rows].reverse()) {
        await apiRequest('/api/serial-records', {
          body: JSON.stringify({
            customerName: row.customerName,
            date: row.date,
            documentNo: row.documentNo,
            model: row.model,
            // Operators scan goods on their way OUT of the warehouse, so every batch is an exit.
            movement: 'خروج',
            productCode: row.productCode,
            serialNo: row.serialNo,
            trackingCode: row.trackingCode,
          }),
          method: 'POST',
        });
      }

      finishSuccessfulBatch(`${rows.length.toLocaleString('fa-IR')} ردیف با موفقیت ارسال شد.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ارسال اطلاعات ناموفق بود.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const saveRows = async () => {
    if (rows.length === 0) {
      return;
    }

    try {
      const result = await saveSerialExcelFile(
        [...rows].reverse(),
        documentNo || 'scanner-records',
      );
      const folderMessage = result.native ? ` در ${result.path}` : '';

      showToast(
        `${rows.length.toLocaleString('fa-IR')} ردیف در فایل اکسل ذخیره شد${folderMessage}.`,
        'success',
      );
    } catch {
      showToast('ذخیره فایل اکسل ناموفق بود.', 'error');
    }
  };

  const clearRows = () => {
    setRows([]);
    setTrackingCode(acPart === 'panel' ? 'panel' : '');
    setSerialNo('');
    setStatusMessage('لیست پاک شد.');
    setStatusTone('default');
    window.requestAnimationFrame(() =>
      (acPart === 'panel' ? serialInputRef.current : trackingInputRef.current)?.focus(),
    );
  };

  if (step === 'login') {
    return (
      <main
        className={
          'grid min-h-dvh content-center gap-6 bg-linear-to-b from-dcode-900 to-dcode-800 px-4 py-4 pb-5 font-sans text-app-ink max-xs:px-3 max-xs:py-3.5 max-xs:pb-4'
        }
      >
        <form
          className={
            'mx-auto grid w-[min(100%,430px)] gap-3.5 rounded-3xl border border-dcode-900/10 bg-app-surface/95 px-4 pt-6 pb-4 shadow-dcode-panel max-xs:rounded-2xl max-xs:px-3.5 max-xs:pt-5 max-xs:pb-3.5'
          }
          onSubmit={login}
        >
          <Image
            className={
              'mx-auto mb-4 h-auto w-[min(245px,68vw)] max-xs:mb-3 max-xs:w-[min(205px,64vw)]'
            }
            src="/dcode-logo-SVG.svg"
            alt="D'CODE"
            width={320}
            height={106}
            priority
          />
          <label
            className={
              'grid min-h-14 grid-cols-[2.75rem_1fr] items-center gap-2 rounded-2xl border border-dcode-900/12 bg-app-surface-soft px-3 text-dcode-red-500 focus-within:border-dcode-red-500 focus-within:ring-4 focus-within:ring-dcode-red-500/10'
            }
          >
            <Person className={'size-6! text-dcode-red-500'} />
            <input
              className={
                'min-h-14 w-full border-0 bg-transparent text-right text-xl font-bold text-dcode-900 outline-none placeholder:text-app-muted max-xs:text-lg'
              }
              name="username"
              value={loginForm.username}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, username: event.target.value }))
              }
              autoComplete="username"
              placeholder="نام کاربری"
            />
          </label>
          <label
            className={
              'grid min-h-14 grid-cols-[2.75rem_1fr] items-center gap-2 rounded-2xl border border-dcode-900/12 bg-app-surface-soft px-3 text-dcode-red-500 focus-within:border-dcode-red-500 focus-within:ring-4 focus-within:ring-dcode-red-500/10'
            }
          >
            <Key className={'size-6! text-dcode-red-500'} />
            <input
              className={
                'min-h-14 w-full border-0 bg-transparent text-right text-xl font-bold text-dcode-900 outline-none placeholder:text-app-muted max-xs:text-lg'
              }
              name="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, password: event.target.value }))
              }
              autoComplete="current-password"
              placeholder="رمز عبور"
              type="password"
            />
          </label>
          <div className={'mt-2 grid grid-cols-2 gap-2.5'}>
            <button
              className={cx(
                'inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border-0 px-4 text-lg font-extrabold text-white shadow-lg disabled:cursor-wait disabled:opacity-50',
                'bg-linear-to-br from-app-ink to-dcode-900',
              )}
              type="button"
            >
              انصراف
            </button>
            <button
              className={cx(
                'inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border-0 px-4 text-lg font-extrabold text-white shadow-lg disabled:cursor-wait disabled:opacity-50',
                'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
              )}
              disabled={isLoggingIn}
              type="submit"
            >
              {isLoggingIn ? 'در حال ورود...' : 'ورود'}
            </button>
          </div>
        </form>
        <span
          className={cx(
            'mt-4 justify-self-center rounded-full px-5 py-2.5 text-center text-sm font-bold text-white shadow-xl',
            statusTone === 'error' ? 'bg-dcode-red-700' : 'bg-dcode-700',
          )}
        >
          {statusMessage}
        </span>
        <span className={'justify-self-center text-xs font-extrabold text-white/60'}>
          نسخه <span dir="ltr">v{APP_VERSION}</span>
        </span>
        {toast && (
          <div
            className={cx(
              'fixed top-3.5 right-3 left-3 z-80 flex min-h-12 items-center justify-start rounded-lg border px-4 py-2.5 text-right text-base font-extrabold shadow-xl max-xs:top-2.5 max-xs:right-2.5 max-xs:left-2.5 max-xs:text-sm',
              toast.tone === 'success'
                ? 'border-emerald-500/25 bg-emerald-50 text-emerald-700'
                : 'border-red-400/25 bg-red-50 text-red-700',
            )}
          >
            {toast.message}
          </div>
        )}
      </main>
    );
  }

  if (step === 'document') {
    return (
      <main
        className={
          'grid min-h-dvh content-center gap-6 bg-linear-to-b from-dcode-900 to-dcode-800 px-4 py-4 pb-5 font-sans text-app-ink max-xs:px-3 max-xs:py-3.5 max-xs:pb-4'
        }
      >
        <form
          className={
            'mx-auto grid w-[min(100%,430px)] gap-3 rounded-3xl border border-dcode-900/10 bg-app-surface/95 px-4 pt-5 pb-4 shadow-dcode-panel max-xs:rounded-2xl'
          }
          onSubmit={startCollection}
        >
          <h1
            className={
              'm-0 mb-1 text-center text-3xl font-black leading-tight text-dcode-900 max-xs:text-2xl'
            }
          >
            اطلاعات مشتری
          </h1>
          <input
            className={cx(
              'min-h-16 w-full rounded-2xl border border-dcode-900/12 bg-app-surface px-4 text-right text-xl font-bold text-dcode-900 outline-none placeholder:text-app-muted focus:border-dcode-red-500 focus:ring-4 focus:ring-dcode-red-500/10 max-xs:text-lg',
              'cursor-default bg-app-surface-soft text-app-muted [direction:ltr] focus:border-dcode-900/12 focus:ring-0',
            )}
            aria-label="تاریخ امروز"
            value={date}
            readOnly
            tabIndex={-1}
          />
          <input
            className={
              'min-h-16 w-full rounded-2xl border border-dcode-900/12 bg-app-surface px-4 text-right text-xl font-bold text-dcode-900 outline-none placeholder:text-app-muted focus:border-dcode-red-500 focus:ring-4 focus:ring-dcode-red-500/10 max-xs:text-lg'
            }
            ref={documentInputRef}
            value={documentNo}
            onChange={(event) => setDocumentNo(normalizeNumberInput(event.target.value))}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="شماره سند"
          />
          <input
            className={
              'min-h-16 w-full rounded-2xl border border-dcode-900/12 bg-app-surface px-4 text-right text-xl font-bold text-dcode-900 outline-none placeholder:text-app-muted focus:border-dcode-red-500 focus:ring-4 focus:ring-dcode-red-500/10 max-xs:text-lg'
            }
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="نام مشتری"
            list="internal-warehouse-names"
          />
          <datalist id="internal-warehouse-names">
            {internalWarehouses.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {internalWarehouses.length > 0 && (
            // Tapping the warehouse instead of typing it keeps the name character-for-character the
            // one the server matches, which is what turns the row into a transfer.
            <div className={'flex flex-wrap gap-2'}>
              {internalWarehouses.map((name) => (
                <button
                  key={name}
                  className={cx(
                    'min-h-10 rounded-xl border px-3 text-base font-bold',
                    isInternalWarehouseName([name], customerName)
                      ? 'border-dcode-red-500 bg-dcode-red-500/10 text-dcode-red-700'
                      : 'border-dcode-900/12 bg-app-surface-soft text-app-muted',
                  )}
                  onClick={() => setCustomerName(name)}
                  type="button"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          {isInternalTransfer && (
            <p className={'text-right text-base font-bold text-dcode-red-700'}>
              انتقال بین انبار — این سند خروج به مشتری ثبت نمی‌شود.
            </p>
          )}
          <div className={'mt-1 grid grid-cols-[1.2fr_0.8fr] gap-2.5'}>
            <button
              className={cx(
                'inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border-0 px-4 text-lg font-extrabold text-white shadow-lg disabled:cursor-wait disabled:opacity-50',
                'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
              )}
              onClick={startCollection}
              type="button"
            >
              جمع آوری بارکد
            </button>
            <button
              className={cx(
                'inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border-0 px-4 text-lg font-extrabold text-white shadow-lg disabled:cursor-wait disabled:opacity-50',
                'bg-linear-to-br from-app-ink to-dcode-900',
              )}
              onClick={() => goToStep('login')}
              type="button"
            >
              خروج
            </button>
          </div>
        </form>
        <span className={'justify-self-center text-xs font-extrabold text-white/60'}>
          نسخه <span dir="ltr">v{APP_VERSION}</span>
        </span>
        {toast && (
          <div
            className={cx(
              'fixed top-3.5 right-3 left-3 z-80 flex min-h-12 items-center justify-start rounded-lg border px-4 py-2.5 text-right text-base font-extrabold shadow-xl max-xs:top-2.5 max-xs:right-2.5 max-xs:left-2.5 max-xs:text-sm',
              toast.tone === 'success'
                ? 'border-emerald-500/25 bg-emerald-50 text-emerald-700'
                : 'border-red-400/25 bg-red-50 text-red-700',
            )}
          >
            {toast.message}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className={'min-h-dvh bg-app-bg px-3 pt-2.5 pb-3 font-sans text-app-ink max-xs:px-2'}>
      <header
        className={
          'grid min-h-14 grid-cols-[2.75rem_1fr_2.75rem] items-center rounded-2xl bg-app-surface px-2 shadow-dcode-soft'
        }
      >
        <div aria-hidden="true" />
        <div className={'grid min-w-0 gap-0.5 text-center'}>
          <h1 className={'m-0 text-2xl font-black leading-tight max-xs:text-2xl'}>اسکن کالا</h1>
          <span
            className={
              'overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-app-muted'
            }
          >
            کاربر جاری: {currentUser?.username ?? '-'} / نسخه: <span dir="ltr">v{APP_VERSION}</span>
          </span>
        </div>
        <button
          className={'grid place-items-center border-0 bg-transparent text-app-ink'}
          aria-label="خانه"
          onClick={() => goToStep('document')}
          type="button"
        >
          <Home className={'size-7!'} />
        </button>
      </header>

      <section className={'my-2.5 grid grid-cols-[0.75fr_1.25fr] gap-2'}>
        <div
          className={
            'grid min-w-0 gap-0.5 rounded-xl border border-dcode-900/12 bg-app-surface px-3 py-2 shadow-dcode-soft'
          }
        >
          <span className={'text-xs font-extrabold text-app-muted'}>سند</span>
          <strong
            className={
              'overflow-hidden text-ellipsis whitespace-nowrap text-base font-extrabold text-dcode-900 max-xs:text-sm'
            }
          >
            {documentNo}
          </strong>
        </div>
        <div
          className={
            'grid min-w-0 gap-0.5 rounded-xl border border-dcode-900/12 bg-app-surface px-3 py-2 shadow-dcode-soft'
          }
        >
          <span className={'text-xs font-extrabold text-app-muted'}>مشتری</span>
          <strong
            className={
              'overflow-hidden text-ellipsis whitespace-nowrap text-base font-extrabold text-dcode-900 max-xs:text-sm'
            }
          >
            {customerName}
          </strong>
        </div>
      </section>

      <section className={'grid gap-2'}>
        <label
          className={
            'group relative grid min-h-20 gap-1 rounded-2xl border border-dcode-900/12 bg-app-surface px-3 pt-2.5 pb-2 shadow-dcode-soft focus-within:border-dcode-red-500 focus-within:ring-4 focus-within:ring-dcode-red-500/10'
          }
        >
          <span
            className={
              'text-right text-sm font-extrabold text-app-muted group-focus-within:text-dcode-red-500'
            }
          >
            شناسه کالا
          </span>
          <div className={'grid min-h-9 grid-cols-[2rem_1fr] items-center gap-3'}>
            <QrCodeScanner className={'size-5! text-dcode-red-500'} />
            <input
              className={
                'min-w-0 w-full border-0 bg-transparent text-right text-xl font-bold leading-tight text-dcode-900 outline-none max-xs:text-lg'
              }
              ref={productInputRef}
              value={productCode}
              onChange={(event) => setProductCode(normalizeNumberInput(event.target.value))}
              onClick={clearProductForNewModel}
              onKeyDown={(event) => handleScanEnter(event, trackingInputRef)}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>
        </label>
        <label
          className={
            'group relative grid min-h-20 gap-1 rounded-2xl border border-dcode-900/12 bg-app-surface px-3 pt-2.5 pb-2 shadow-dcode-soft focus-within:border-dcode-red-500 focus-within:ring-4 focus-within:ring-dcode-red-500/10'
          }
        >
          <span
            className={
              'text-right text-sm font-extrabold text-app-muted group-focus-within:text-dcode-red-500'
            }
          >
            کد رهگیری
          </span>
          <div className={'grid min-h-9 grid-cols-[2rem_1fr] items-center gap-3'}>
            <QrCodeScanner className={'size-5! text-dcode-red-500'} />
            <input
              className={
                'min-w-0 w-full border-0 bg-transparent text-right text-xl font-bold leading-tight text-dcode-900 outline-none max-xs:text-lg'
              }
              ref={trackingInputRef}
              value={trackingCode}
              onChange={(event) =>
                acPart === 'panel'
                  ? setTrackingCode('panel')
                  : setTrackingCode(normalizeNumberInput(event.target.value))
              }
              onKeyDown={(event) => handleScanEnter(event, serialInputRef)}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              inputMode="numeric"
              pattern="[0-9]*"
              readOnly={acPart === 'panel'}
            />
          </div>
        </label>
        <label
          className={
            'group relative grid min-h-20 gap-1 rounded-2xl border border-dcode-900/12 bg-app-surface px-3 pt-2.5 pb-2 shadow-dcode-soft focus-within:border-dcode-red-500 focus-within:ring-4 focus-within:ring-dcode-red-500/10'
          }
        >
          <span
            className={
              'text-right text-sm font-extrabold text-app-muted group-focus-within:text-dcode-red-500'
            }
          >
            شماره سریال
          </span>
          <div className={'grid min-h-9 grid-cols-[2rem_1fr] items-center gap-3'}>
            <QrCodeScanner className={'size-5! text-dcode-red-500'} />
            <input
              className={
                'min-w-0 w-full border-0 bg-transparent text-right text-xl font-bold leading-tight text-dcode-900 outline-none max-xs:text-lg'
              }
              ref={serialInputRef}
              value={serialNo}
              onChange={(event) => setSerialNo(normalizeScan(event.target.value))}
              onKeyDown={(event) => handleScanEnter(event, 'add')}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
            />
          </div>
        </label>
      </section>

      <section className={'mt-2.5 grid grid-cols-3 gap-2'}>
        <button
          className={cx(
            'inline-flex min-h-12 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-xl border-0 px-2 text-base font-extrabold text-white shadow-md disabled:opacity-50 max-xs:text-sm',
            'bg-dcode-900',
          )}
          disabled={rows.length === 0 || isSending || isCompleting}
          onClick={sendRows}
          type="button"
        >
          <Send className={'size-5!'} />
          {isSending ? 'ارسال...' : 'ارسال'}
        </button>
        <button
          className={cx(
            'inline-flex min-h-12 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-xl border-0 px-2 text-base font-extrabold text-white shadow-md disabled:opacity-50 max-xs:text-sm',
            'bg-dcode-red-500',
          )}
          disabled={rows.length === 0 || isCompleting}
          onClick={saveRows}
          type="button"
        >
          <Save className={'size-5!'} />
          ذخیره
        </button>
        <button
          className={cx(
            'inline-flex min-h-12 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-xl border-0 px-2 text-base font-extrabold text-white shadow-md disabled:opacity-50 max-xs:text-sm',
            'bg-slate-800',
          )}
          disabled={rows.length === 0 || isCompleting}
          onClick={clearRows}
          type="button"
        >
          <Close className={'size-5!'} />
          پاکسازی
        </button>
      </section>
      {toast && (
        <div
          className={cx(
            'mt-2.5 flex min-h-12 items-center justify-start rounded-xl border px-3 py-2 text-right text-sm font-extrabold shadow-dcode-soft',
            toast.tone === 'success'
              ? 'border-emerald-500/25 bg-emerald-50 text-emerald-700'
              : 'border-red-400/25 bg-red-50 text-red-700',
          )}
        >
          {toast.message}
        </div>
      )}

      <section
        className={
          'mt-4 flex min-h-12 items-center justify-between gap-2.5 px-1 py-0.5 text-base font-black text-dcode-900'
        }
      >
        <strong>تعداد: {rows.length.toLocaleString('fa-IR')}</strong>
        <div className={'flex items-center gap-2'} aria-label="نوع قطعه کولر">
          <button
            aria-pressed={acPart === 'panel'}
            className={cx(
              'inline-flex min-h-10 min-w-19.5 items-center justify-center rounded-full border border-app-line bg-app-surface px-4 text-sm font-black text-dcode-900 shadow-none',
              acPart === 'panel' && 'border-dcode-red-500 bg-dcode-red-500 text-white',
            )}
            onClick={() => selectAcPart('panel')}
            type="button"
          >
            پنل
          </button>
          <button
            aria-pressed={acPart === 'motor'}
            className={cx(
              'inline-flex min-h-10 min-w-19.5 items-center justify-center rounded-full border border-app-line bg-app-surface px-4 text-sm font-black text-dcode-900 shadow-none',
              acPart === 'motor' && 'border-dcode-red-500 bg-dcode-red-500 text-white',
            )}
            onClick={() => selectAcPart('motor')}
            type="button"
          >
            موتور
          </button>
        </div>
      </section>

      <section
        className={
          'flex min-h-10 items-center justify-between gap-2.5 px-1 text-base font-extrabold'
        }
      >
        <span className={'overflow-hidden text-ellipsis whitespace-nowrap text-dcode-900'}>
          {currentModel?.model || 'مدل نامشخص'}
        </span>
      </section>

      <section
        className={
          'grid min-h-36 max-h-[calc(100dvh-438px)] content-start overflow-y-auto rounded-2xl bg-app-surface p-2 shadow-[inset_0_0_0_1px_rgb(21_49_66/10%)]'
        }
      >
        {rows.map((row, index) => (
          <article
            className={
              'grid min-h-20 grid-cols-[2rem_1fr_3rem] items-center gap-2 rounded-xl bg-app-surface-soft px-2.5 py-2 text-lg text-dcode-red-500 [&+&]:mt-2.5'
            }
            key={row.id}
          >
            <span className={'font-extrabold text-dcode-900'}>{rows.length - index}</span>
            <div className={'grid min-w-0 gap-0.5'}>
              <strong className={'wrap-anywhere text-lg font-black leading-tight'}>
                {row.productCode}
              </strong>
              <small className={'wrap-anywhere text-base font-semibold leading-tight'}>
                {row.trackingCode}
              </small>
              <small className={'wrap-anywhere text-base font-semibold leading-tight'}>
                {row.serialNo}
              </small>
            </div>
            <button
              className={
                'grid min-h-11 w-full place-items-center rounded-xl border-0 bg-app-surface text-dcode-red-500'
              }
              aria-label="حذف"
              onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
              type="button"
            >
              <Delete className={'size-6!'} />
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
