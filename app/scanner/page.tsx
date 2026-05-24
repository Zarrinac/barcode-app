'use client';

import {
  Close,
  Delete,
  Home,
  Key,
  Menu,
  Person,
  QrCodeScanner,
  Save,
  Send,
} from '@mui/icons-material';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ensureSerialExcelFolder, saveSerialExcelFile } from '@/lib/serial-excel';

type ScannerStep = 'login' | 'document' | 'collect';
type AcPart = 'motor' | 'panel' | null;

type ProductModel = {
  id: string;
  model: string;
  productCode: string;
  warrantyCode: string;
  createdAt: string;
  updatedAt: string;
  status: 'فعال' | 'غیرفعال';
};

type ScanRow = {
  id: string;
  date: string;
  documentNo: string;
  customerName: string;
  productCode: string;
  model: string;
  partType: AcPart;
  trackingCode: string;
  serialNo: string;
};

type ScannerToast = {
  message: string;
  tone: 'success' | 'error';
};

type ProductModelsResponse = {
  models: ProductModel[];
};

type AuthUser = {
  role: string;
  username: string;
};

type SessionResponse =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      user: AuthUser;
    };

type LoginResponse = {
  ok: true;
  user: AuthUser;
};

const scannerStorageKey = 'barcode-app-scanner-session';
const scannerSuccessToastMs = 2800;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const scannerUi = {
  authScreen:
    'grid min-h-dvh content-center gap-[26px] bg-gradient-to-b from-dcode-bg to-[#151b27] px-4 py-[18px] pb-[22px] font-sans text-dcode-ink max-[380px]:px-3 max-[380px]:py-3.5 max-[380px]:pb-[18px]',
  authCard:
    'mx-auto grid w-[min(100%,430px)] gap-3.5 rounded-[24px] border border-dcode-bg/10 bg-white/95 p-[26px_18px_18px] shadow-[0_18px_42px_rgb(15_35_52_/_14%)] max-[380px]:rounded-[20px] max-[380px]:p-[22px_14px_14px]',
  logo: 'mx-auto mb-4 h-auto w-[min(245px,68vw)] max-[380px]:mb-3 max-[380px]:w-[min(205px,64vw)]',
  loginField:
    'grid min-h-[58px] grid-cols-[42px_1fr] items-center gap-2 rounded-2xl border border-dcode-bg/12 bg-slate-50 px-3 text-dcode-red focus-within:border-dcode-red focus-within:shadow-[0_0_0_4px_rgb(255_43_61_/_11%)]',
  loginIcon: '!size-6 text-dcode-red',
  loginInput:
    'min-h-[54px] w-full border-0 bg-transparent text-right text-[21px] font-[780] text-dcode-bg outline-none placeholder:text-slate-500 max-[380px]:text-[19px]',
  loginActions: 'mt-2 grid grid-cols-2 gap-2.5',
  documentCard:
    'mx-auto grid w-[min(100%,430px)] gap-3 rounded-[24px] border border-dcode-bg/10 bg-white/95 p-[22px_16px_16px] shadow-[0_18px_42px_rgb(15_35_52_/_14%)] max-[380px]:rounded-[20px]',
  documentTitle:
    'm-0 mb-1 text-center text-[28px] font-black leading-tight text-dcode-bg max-[380px]:text-[25px]',
  documentInput:
    'min-h-[66px] w-full rounded-2xl border border-dcode-bg/12 bg-white px-4 text-right text-[21px] font-[760] text-dcode-bg outline-none placeholder:text-slate-500 focus:border-dcode-red focus:shadow-[0_0_0_4px_rgb(255_43_61_/_11%)] max-[380px]:text-[19px]',
  readonlyInput:
    'cursor-default bg-slate-50 text-slate-500 [direction:ltr] focus:border-dcode-bg/12 focus:shadow-none',
  documentActions: 'mt-1 grid grid-cols-[1.2fr_0.8fr] gap-2.5',
  button:
    'inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-[14px] border-0 px-[18px] text-lg font-[820] text-white shadow-[0_10px_24px_rgb(15_35_52_/_12%)] disabled:cursor-wait disabled:opacity-50',
  redButton: 'bg-gradient-to-br from-dcode-red to-[#c70f20]',
  darkButton: 'bg-gradient-to-br from-[#111111] to-dcode-bg',
  offlinePill:
    'mt-[18px] justify-self-center rounded-full bg-[#05090a] px-5 py-2.5 text-center text-[15px] font-[760] text-white shadow-[0_12px_28px_rgb(0_0_0_/_18%)]',
  collectScreen:
    'min-h-dvh bg-dcode-light px-3 pt-2.5 pb-3 font-sans text-dcode-ink max-[380px]:px-2',
  collectHeader:
    'grid min-h-[58px] grid-cols-[44px_1fr_44px] items-center rounded-[18px] bg-white px-2 shadow-[0_8px_24px_rgb(15_35_52_/_8%)]',
  iconButton: 'grid place-items-center border-0 bg-transparent text-[#252229]',
  headerIcon: '!size-7',
  collectTitle: 'm-0 text-center text-[25px] font-black max-[380px]:text-[23px]',
  summaryGrid: 'my-2.5 grid grid-cols-[0.75fr_1.25fr] gap-2',
  summaryCard:
    'grid min-w-0 gap-0.5 rounded-[14px] border border-dcode-bg/12 bg-white px-3 py-[9px] shadow-[0_8px_22px_rgb(15_35_52_/_6%)]',
  summaryLabel: 'text-[12px] font-extrabold text-slate-500',
  summaryValue:
    'overflow-hidden text-ellipsis whitespace-nowrap text-base font-[850] text-dcode-bg max-[380px]:text-sm',
  scanFields: 'grid gap-2',
  scanField:
    'group relative grid min-h-[74px] gap-1 rounded-2xl border border-dcode-bg/12 bg-white px-3 pt-2.5 pb-2 shadow-[0_8px_22px_rgb(15_35_52_/_6%)] focus-within:border-dcode-red focus-within:shadow-[0_0_0_3px_rgb(255_43_61_/_11%),0_10px_24px_rgb(15_35_52_/_8%)]',
  scanLabel: 'text-right text-[13px] font-[850] text-slate-500 group-focus-within:text-dcode-red',
  scanInputRow: 'grid min-h-9 grid-cols-[30px_1fr] items-center gap-3',
  scanIcon: '!size-[22px] text-dcode-red',
  scanInput:
    'min-w-0 w-full border-0 bg-transparent text-right text-[21px] font-[760] leading-tight text-dcode-bg outline-none max-[380px]:text-[19px]',
  actionRow: 'mt-2.5 grid grid-cols-3 gap-2',
  actionButton:
    'inline-flex min-h-12 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-[14px] border-0 px-2 text-base font-[820] text-white shadow-[0_3px_7px_rgb(0_0_0_/_18%)] disabled:opacity-50 max-[380px]:text-sm',
  actionIcon: '!size-[21px]',
  acPartRow:
    'mt-4 flex min-h-[46px] items-center justify-between gap-2.5 px-1 py-0.5 text-base font-black text-dcode-bg',
  acPartGroup: 'flex items-center gap-2',
  acPartButton:
    'inline-flex min-h-10 min-w-[78px] items-center justify-center rounded-full border border-dcode-line bg-white px-4 text-[15px] font-black text-dcode-bg shadow-none',
  acPartButtonActive: 'border-dcode-red bg-dcode-red text-white',
  countRow: 'flex min-h-[42px] items-center justify-between gap-2.5 px-1 text-base font-extrabold',
  countText: 'overflow-hidden text-ellipsis whitespace-nowrap text-dcode-bg',
  recordList:
    'grid min-h-[150px] max-h-[calc(100dvh-438px)] content-start overflow-y-auto rounded-2xl bg-white p-2 shadow-[inset_0_0_0_1px_rgb(21_49_66_/_10%)]',
  recordCard:
    'grid min-h-[74px] grid-cols-[32px_1fr_48px] items-center gap-2 rounded-[14px] bg-slate-50 p-[8px_10px] text-lg text-dcode-red [&+&]:mt-2.5',
  recordIndex: 'font-[850] text-dcode-bg',
  recordBody: 'grid min-w-0 gap-0.5',
  recordStrong: '[overflow-wrap:anywhere] text-[19px] font-black leading-tight',
  recordSmall: '[overflow-wrap:anywhere] text-[17px] font-[650] leading-tight',
  recordDelete:
    'grid min-h-11 w-full place-items-center rounded-xl border-0 bg-white text-dcode-red',
  recordDeleteIcon: '!size-[25px]',
  statusLine: 'mt-[7px] min-h-[22px] text-center text-sm font-bold text-slate-700',
  toast:
    'fixed top-3.5 right-3 left-3 z-80 flex min-h-12 items-center justify-start rounded-[10px] border px-4 py-2.5 text-right text-base font-[850] shadow-[0_12px_28px_rgb(15_35_52_/_10%)] max-[380px]:top-2.5 max-[380px]:right-2.5 max-[380px]:left-2.5 max-[380px]:text-sm',
  toastSuccess: 'border-dcode-red/25 bg-[#fff1f3] text-[#c70f20]',
  toastError: 'border-[#ef6254]/25 bg-[#fff0ee] text-[#b42318]',
};

const persianDatePartsFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatPersianDate(date: Date) {
  const parts = persianDatePartsFormatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${getPart('year')}/${getPart('month')}/${getPart('day')}`;
}

function normalizeScan(value: string) {
  return value.replace(/[\r\n\t]/g, '').trim();
}

function normalizeNumberInput(value: string) {
  const normalizedDigits = normalizeScan(value).replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    const persianIndex = persianDigits.indexOf(digit);

    if (persianIndex >= 0) {
      return String(persianIndex);
    }

    return String(arabicDigits.indexOf(digit));
  });

  return normalizedDigits.replace(/\D/g, '');
}

function getDefaultStatusMessage(step: ScannerStep) {
  if (step === 'login') {
    return 'نام کاربری و رمز عبور را وارد کنید.';
  }

  if (step === 'document') {
    return 'آماده ثبت سند';
  }

  return 'جمع آوری بارکد';
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
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
  const [statusMessage, setStatusMessage] = useState('نام کاربری و رمز عبور را وارد کنید.');
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
  }, []);

  const modelByProductCode = useMemo(() => {
    return new Map(models.map((model) => [model.productCode, model]));
  }, [models]);

  const currentModel = modelByProductCode.get(productCode);

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
          setStatusMessage('نام کاربری و رمز عبور را وارد کنید.');
          return;
        }

        setDate(formatPersianDate(new Date()));
        goToStep('document');
      } catch {
        if (!isCancelled) {
          setStatusMessage('نام کاربری و رمز عبور را وارد کنید.');
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
      .then((data) => setModels(data.models))
      .catch(() => setStatusMessage('لیست مدل کالا دریافت نشد.'));
  }, [step]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 2400);

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

  const addRow = useCallback(() => {
    const cleanProductCode = normalizeNumberInput(productCode);
    const cleanTrackingCode = acPart === 'panel' ? 'panel' : normalizeNumberInput(trackingCode);
    const cleanSerialNo = normalizeScan(serialNo);

    if (!cleanProductCode || !cleanTrackingCode || !cleanSerialNo) {
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
  }, [
    acPart,
    customerName,
    date,
    documentNo,
    modelByProductCode,
    productCode,
    serialNo,
    trackingCode,
  ]);

  const login = async (
    event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
  ) => {
    event?.preventDefault();
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setStatusMessage('نام کاربری و رمز عبور را وارد کنید.');
      return;
    }

    setIsLoggingIn(true);

    try {
      await apiRequest<LoginResponse>('/api/login', {
        body: JSON.stringify(loginForm),
        method: 'POST',
      });
      window.localStorage.setItem('barcode-app-login', JSON.stringify(true));
      setDate(formatPersianDate(new Date()));
      goToStep('document');
    } catch (error) {
      window.localStorage.removeItem('barcode-app-login');
      setStatusMessage(error instanceof Error ? error.message : 'ورود ناموفق بود.');
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
      return;
    }

    goToStep('collect');
  };

  const handleScanEnter = (
    event: React.KeyboardEvent<HTMLInputElement>,
    next: React.RefObject<HTMLInputElement | null> | 'add',
  ) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (next === 'add') {
      addRow();
      return;
    }

    next.current?.focus();
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

  const showToast = (message: string, tone: ScannerToast['tone']) => {
    setToast({ message, tone });
    setStatusMessage(message);
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

    setIsSending(true);
    try {
      for (const row of [...rows].reverse()) {
        await apiRequest('/api/serial-records', {
          body: JSON.stringify({
            customerName: row.customerName,
            date: row.date,
            documentNo: row.documentNo,
            model: row.model,
            movement: 'ورود',
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
    window.requestAnimationFrame(() =>
      (acPart === 'panel' ? serialInputRef.current : trackingInputRef.current)?.focus(),
    );
  };

  if (step === 'login') {
    return (
      <main className={scannerUi.authScreen}>
        <form className={scannerUi.authCard} onSubmit={login}>
          <Image
            className={scannerUi.logo}
            src="/dcode-logo-SVG.svg"
            alt="D'CODE"
            width={320}
            height={106}
            priority
          />
          <label className={scannerUi.loginField}>
            <Person className={scannerUi.loginIcon} />
            <input
              className={scannerUi.loginInput}
              name="username"
              value={loginForm.username}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, username: event.target.value }))
              }
              autoComplete="username"
              placeholder="نام کاربری"
            />
          </label>
          <label className={scannerUi.loginField}>
            <Key className={scannerUi.loginIcon} />
            <input
              className={scannerUi.loginInput}
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
          <div className={scannerUi.loginActions}>
            <button className={cx(scannerUi.button, scannerUi.darkButton)} type="button">
              انصراف
            </button>
            <button
              className={cx(scannerUi.button, scannerUi.redButton)}
              disabled={isLoggingIn}
              type="submit"
            >
              {isLoggingIn ? 'در حال ورود...' : 'ورود'}
            </button>
          </div>
        </form>
        <span className={scannerUi.offlinePill}>{statusMessage}</span>
        {toast && (
          <div
            className={cx(
              scannerUi.toast,
              toast.tone === 'success' ? scannerUi.toastSuccess : scannerUi.toastError,
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
      <main className={scannerUi.authScreen}>
        <form className={scannerUi.documentCard} onSubmit={startCollection}>
          <h1 className={scannerUi.documentTitle}>اطلاعات مشتری</h1>
          <input
            className={cx(scannerUi.documentInput, scannerUi.readonlyInput)}
            aria-label="تاریخ امروز"
            value={date}
            readOnly
            tabIndex={-1}
          />
          <input
            className={scannerUi.documentInput}
            ref={documentInputRef}
            value={documentNo}
            onChange={(event) => setDocumentNo(normalizeNumberInput(event.target.value))}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="شماره سند"
          />
          <input
            className={scannerUi.documentInput}
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="نام مشتری"
          />
          <div className={scannerUi.documentActions}>
            <button
              className={cx(scannerUi.button, scannerUi.redButton)}
              onClick={startCollection}
              type="button"
            >
              جمع آوری بارکد
            </button>
            <button
              className={cx(scannerUi.button, scannerUi.darkButton)}
              onClick={() => goToStep('login')}
              type="button"
            >
              خروج
            </button>
          </div>
        </form>
        {toast && (
          <div
            className={cx(
              scannerUi.toast,
              toast.tone === 'success' ? scannerUi.toastSuccess : scannerUi.toastError,
            )}
          >
            {toast.message}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className={scannerUi.collectScreen}>
      <header className={scannerUi.collectHeader}>
        <button className={scannerUi.iconButton} aria-label="منو" type="button">
          <Menu className={scannerUi.headerIcon} />
        </button>
        <h1 className={scannerUi.collectTitle}>اسکن کالا</h1>
        <button
          className={scannerUi.iconButton}
          aria-label="خانه"
          onClick={() => goToStep('document')}
          type="button"
        >
          <Home className={scannerUi.headerIcon} />
        </button>
      </header>

      <section className={scannerUi.summaryGrid}>
        <div className={scannerUi.summaryCard}>
          <span className={scannerUi.summaryLabel}>سند</span>
          <strong className={scannerUi.summaryValue}>{documentNo}</strong>
        </div>
        <div className={scannerUi.summaryCard}>
          <span className={scannerUi.summaryLabel}>مشتری</span>
          <strong className={scannerUi.summaryValue}>{customerName}</strong>
        </div>
      </section>

      <section className={scannerUi.scanFields}>
        <label className={scannerUi.scanField}>
          <span className={scannerUi.scanLabel}>شناسه کالا</span>
          <div className={scannerUi.scanInputRow}>
            <QrCodeScanner className={scannerUi.scanIcon} />
            <input
              className={scannerUi.scanInput}
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
        <label className={scannerUi.scanField}>
          <span className={scannerUi.scanLabel}>کد رهگیری</span>
          <div className={scannerUi.scanInputRow}>
            <QrCodeScanner className={scannerUi.scanIcon} />
            <input
              className={scannerUi.scanInput}
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
        <label className={scannerUi.scanField}>
          <span className={scannerUi.scanLabel}>شماره سریال</span>
          <div className={scannerUi.scanInputRow}>
            <QrCodeScanner className={scannerUi.scanIcon} />
            <input
              className={scannerUi.scanInput}
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

      <section className={scannerUi.actionRow}>
        <button
          className={cx(scannerUi.actionButton, 'bg-dcode-bg')}
          disabled={rows.length === 0 || isSending || isCompleting}
          onClick={sendRows}
          type="button"
        >
          <Send className={scannerUi.actionIcon} />
          {isSending ? 'ارسال...' : 'ارسال'}
        </button>
        <button
          className={cx(scannerUi.actionButton, 'bg-dcode-red')}
          disabled={rows.length === 0 || isCompleting}
          onClick={saveRows}
          type="button"
        >
          <Save className={scannerUi.actionIcon} />
          ذخیره
        </button>
        <button
          className={cx(scannerUi.actionButton, 'bg-slate-800')}
          disabled={rows.length === 0 || isCompleting}
          onClick={clearRows}
          type="button"
        >
          <Close className={scannerUi.actionIcon} />
          پاکسازی
        </button>
      </section>

      <section className={scannerUi.acPartRow}>
        <strong>تعداد: {rows.length.toLocaleString('fa-IR')}</strong>
        <div className={scannerUi.acPartGroup} aria-label="نوع قطعه کولر">
          <button
            aria-pressed={acPart === 'panel'}
            className={cx(
              scannerUi.acPartButton,
              acPart === 'panel' && scannerUi.acPartButtonActive,
            )}
            onClick={() => selectAcPart('panel')}
            type="button"
          >
            پنل
          </button>
          <button
            aria-pressed={acPart === 'motor'}
            className={cx(
              scannerUi.acPartButton,
              acPart === 'motor' && scannerUi.acPartButtonActive,
            )}
            onClick={() => selectAcPart('motor')}
            type="button"
          >
            موتور
          </button>
        </div>
      </section>

      <section className={scannerUi.countRow}>
        <span className={scannerUi.countText}>{currentModel?.model || 'مدل نامشخص'}</span>
      </section>

      <section className={scannerUi.recordList}>
        {rows.map((row, index) => (
          <article className={scannerUi.recordCard} key={row.id}>
            <span className={scannerUi.recordIndex}>{rows.length - index}</span>
            <div className={scannerUi.recordBody}>
              <strong className={scannerUi.recordStrong}>{row.productCode}</strong>
              <small className={scannerUi.recordSmall}>{row.trackingCode}</small>
              <small className={scannerUi.recordSmall}>{row.serialNo}</small>
            </div>
            <button
              className={scannerUi.recordDelete}
              aria-label="حذف"
              onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
              type="button"
            >
              <Delete className={scannerUi.recordDeleteIcon} />
            </button>
          </article>
        ))}
      </section>
      <p className={scannerUi.statusLine}>{statusMessage}</p>
      {toast && (
        <div
          className={cx(
            scannerUi.toast,
            toast.tone === 'success' ? scannerUi.toastSuccess : scannerUi.toastError,
          )}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
