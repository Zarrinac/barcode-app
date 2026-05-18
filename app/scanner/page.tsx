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

import { downloadSerialExcelFile } from '@/lib/serial-excel';

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

const scannerStorageKey = 'barcode-app-scanner-session';

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
  const [statusMessage, setStatusMessage] = useState('عدم اتصال به اینترنت');
  const [toast, setToast] = useState<ScannerToast | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const trackingInputRef = useRef<HTMLInputElement>(null);
  const serialInputRef = useRef<HTMLInputElement>(null);

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
      window.requestAnimationFrame(() =>
        (productCode
          ? acPart === 'panel'
            ? serialInputRef.current
            : trackingInputRef.current
          : productInputRef.current
        )?.focus(),
      );
    }
  }, [acPart, productCode, step]);

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

  const login = (
    event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
  ) => {
    event?.preventDefault();
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setStatusMessage('نام کاربری و رمز عبور را وارد کنید.');
      return;
    }

    window.localStorage.setItem('barcode-app-login', JSON.stringify(true));
    window.document.cookie = 'barcode-app-login=true; path=/; max-age=2592000; samesite=lax';
    setDate(formatPersianDate(new Date()));
    setStep('document');
    setStatusMessage('آماده ثبت سند');
  };

  const startCollection = (
    event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
  ) => {
    event?.preventDefault();
    if (!documentNo.trim() || !customerName.trim()) {
      setStatusMessage('شماره سند و نام مشتری را وارد کنید.');
      return;
    }

    setStep('collect');
    setStatusMessage('جمع آوری بارکد');
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
      setDocumentNo('');
      setCustomerName('');
      setDate(formatPersianDate(new Date()));
      setStep('document');
      setIsCompleting(false);
      window.localStorage.removeItem(scannerStorageKey);
    }, 1800);
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

  const saveRows = () => {
    if (rows.length === 0) {
      return;
    }

    try {
      downloadSerialExcelFile([...rows].reverse(), documentNo || 'scanner-records');
      showToast(`${rows.length.toLocaleString('fa-IR')} ردیف در فایل اکسل ذخیره شد.`, 'success');
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
      <main className="scanner-app scanner-login-screen">
        <form className="scanner-login-card" onSubmit={login}>
          <Image
            className="scanner-logo"
            src="/hisense-logo-svg.svg"
            alt="Hisense"
            width={320}
            height={52}
            priority
          />
          <label>
            <Person />
            <input
              value={loginForm.username}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, username: event.target.value }))
              }
              autoComplete="username"
              placeholder="نام کاربری"
            />
          </label>
          <label>
            <Key />
            <input
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, password: event.target.value }))
              }
              autoComplete="current-password"
              placeholder="رمز عبور"
              type="password"
            />
          </label>
          <div className="scanner-login-actions">
            <button className="scanner-danger-button" type="button">
              انصراف
            </button>
            <button className="scanner-yellow-button" onClick={login} type="button">
              ورود
            </button>
          </div>
        </form>
        <span className="scanner-offline-pill">{statusMessage}</span>
        {toast && <div className={`scanner-toast ${toast.tone}`}>{toast.message}</div>}
      </main>
    );
  }

  if (step === 'document') {
    return (
      <main className="scanner-app scanner-document-screen">
        <form className="scanner-document-card" onSubmit={startCollection}>
          <h1>اطلاعات مشتری</h1>
          <input aria-label="تاریخ امروز" value={date} readOnly tabIndex={-1} />
          <input
            ref={documentInputRef}
            value={documentNo}
            onChange={(event) => setDocumentNo(normalizeNumberInput(event.target.value))}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="شماره سند"
          />
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="نام مشتری"
          />
          <div className="scanner-document-actions">
            <button className="scanner-light-button" onClick={startCollection} type="button">
              جمع آوری بارکد
            </button>
            <button
              className="scanner-danger-button compact"
              onClick={() => setStep('login')}
              type="button"
            >
              خروج
            </button>
          </div>
        </form>
        {toast && <div className={`scanner-toast ${toast.tone}`}>{toast.message}</div>}
      </main>
    );
  }

  return (
    <main className="scanner-app scanner-collect-screen">
      <header className="scanner-collect-header">
        <button aria-label="منو" type="button">
          <Menu />
        </button>
        <h1>اسکن کالا</h1>
        <button aria-label="خانه" onClick={() => setStep('document')} type="button">
          <Home />
        </button>
      </header>

      <section className="scanner-session-summary">
        <div>
          <span>سند</span>
          <strong>{documentNo}</strong>
        </div>
        <div>
          <span>مشتری</span>
          <strong>{customerName}</strong>
        </div>
      </section>

      <section className="scanner-scan-fields">
        <label>
          <span>شناسه کالا</span>
          <div>
            <QrCodeScanner />
            <input
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
        <label>
          <span>کد رهگیری</span>
          <div>
            <QrCodeScanner />
            <input
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
        <label>
          <span>شماره سریال</span>
          <div>
            <QrCodeScanner />
            <input
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

      <section className="scanner-action-row">
        <button
          className="scanner-blue-button"
          disabled={rows.length === 0 || isSending || isCompleting}
          onClick={sendRows}
          type="button"
        >
          <Send />
          {isSending ? 'ارسال...' : 'ارسال'}
        </button>
        <button
          className="scanner-pink-button"
          disabled={rows.length === 0 || isCompleting}
          onClick={saveRows}
          type="button"
        >
          <Save />
          ذخیره
        </button>
        <button
          className="scanner-green-button"
          disabled={rows.length === 0 || isCompleting}
          onClick={clearRows}
          type="button"
        >
          <Close />
          پاکسازی
        </button>
      </section>

      <section className="scanner-ac-part-row">
        <strong>تعداد: {rows.length.toLocaleString('fa-IR')}</strong>
        <div aria-label="نوع قطعه کولر">
          <button
            aria-pressed={acPart === 'panel'}
            className={acPart === 'panel' ? 'active' : ''}
            onClick={() => selectAcPart('panel')}
            type="button"
          >
            پنل
          </button>
          <button
            aria-pressed={acPart === 'motor'}
            className={acPart === 'motor' ? 'active' : ''}
            onClick={() => selectAcPart('motor')}
            type="button"
          >
            موتور
          </button>
        </div>
      </section>

      <section className="scanner-count-row">
        <span>{currentModel?.model || 'مدل نامشخص'}</span>
      </section>

      <section className="scanner-record-list">
        {rows.map((row, index) => (
          <article className="scanner-record-card" key={row.id}>
            <span>{rows.length - index}</span>
            <div>
              <strong>{row.productCode}</strong>
              <small>{row.trackingCode}</small>
              <small>{row.serialNo}</small>
            </div>
            <button
              aria-label="حذف"
              onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
              type="button"
            >
              <Delete />
            </button>
          </article>
        ))}
      </section>
      <p className="scanner-status-line">{statusMessage}</p>
      {toast && <div className={`scanner-toast ${toast.tone}`}>{toast.message}</div>}
    </main>
  );
}
