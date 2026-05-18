'use client';

import {
  Add,
  ArchiveOutlined,
  BadgeOutlined,
  CalendarMonthOutlined,
  DashboardOutlined,
  Delete,
  Download,
  EditOutlined,
  Inventory2Outlined,
  LoginOutlined,
  Logout,
  QrCodeScanner,
  Search,
  TableRowsOutlined,
  Upload,
} from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';

import { downloadSerialExcelFile } from '@/lib/serial-excel';

type ViewId = 'serial-new' | 'serial-list' | 'product-new' | 'product-list' | 'locations';
type MovementType = 'ورود' | 'خروج';
type ScanMode = 'lookup' | 'inbound' | 'outbound';
type SerialStatus = 'ثبت شده' | 'خروج شده';

type ProductModel = {
  id: string;
  model: string;
  productCode: string;
  warrantyCode: string;
  createdAt: string;
  updatedAt: string;
  status: 'فعال' | 'غیرفعال';
};

type SerialRecord = {
  id: string;
  date: string;
  documentNo: string;
  customerName: string;
  productCode: string;
  model: string;
  trackingCode: string;
  serialNo: string;
  movement: MovementType;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  status: SerialStatus;
};

type LocationSummary = {
  id: string;
  name: string;
  code: string;
  count: number;
  isActive: boolean;
};

type BootstrapData = {
  locations: LocationSummary[];
  models: ProductModel[];
  serials: SerialRecord[];
};

type ProductDraft = {
  id?: string;
  model: string;
  productCode: string;
  warrantyCode: string;
};

type SerialDraft = {
  id?: string;
  date: string;
  documentNo: string;
  customerName: string;
  productCode: string;
  model: string;
  trackingCode: string;
  serialNo: string;
  movement: MovementType;
  status?: SerialStatus;
};

type LocationDraft = {
  id?: string;
  name: string;
  code: string;
};

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

type PersianDateParts = {
  year: number;
  month: number;
  day: number;
};

type ProductModelResponse = {
  model: ProductModel;
};

type SerialRecordResponse = {
  serial: SerialRecord;
};

type LocationResponse = {
  location: LocationSummary;
};

type ScanResponse = {
  action:
    | 'FOUND'
    | 'NOT_FOUND'
    | 'PRODUCT_SELECTED'
    | 'TRACKING_SELECTED'
    | 'INBOUND_CREATED'
    | 'OUTBOUND_CREATED';
  barcode: string;
  matchedModel: ProductModel | null;
  message: string;
  serial: SerialRecord | null;
  trackingCode?: string | null;
};

type ScanContext = {
  model: ProductModel | null;
  trackingCode: string;
};

const persianDatePartsFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const persianMonthNames = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

const persianWeekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function getPersianDateParts(date: Date): PersianDateParts {
  const parts = persianDatePartsFormatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
  };
}

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

function formatPersianDateParts(parts: PersianDateParts) {
  return `${parts.year}/${padDatePart(parts.month)}/${padDatePart(parts.day)}`;
}

function formatPersianDate(date: Date) {
  return formatPersianDateParts(getPersianDateParts(date));
}

function normalizeDateDigits(value: string) {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

  return value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
}

function parsePersianDate(value: string): PersianDateParts | null {
  const match = normalizeDateDigits(value).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

  if (!match) {
    return null;
  }

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  if (
    !Number.isInteger(parts.year) ||
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31
  ) {
    return null;
  }

  return parts;
}

function getPersianMonthDates(year: number, month: number) {
  const dates: Array<{ date: Date; parts: PersianDateParts }> = [];
  const cursor = new Date(year + 620, 0, 1, 12);
  const end = new Date(year + 622, 11, 31, 12);

  while (cursor <= end) {
    const current = new Date(cursor);
    const parts = getPersianDateParts(current);

    if (parts.year === year && parts.month === month) {
      dates.push({ date: current, parts });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getPersianWeekIndex(date: Date) {
  return (date.getDay() + 1) % 7;
}

const today = formatPersianDate(new Date());

const emptyProductDraft: ProductDraft = {
  model: '',
  productCode: '',
  warrantyCode: '',
};

const emptyLocationDraft: LocationDraft = {
  name: '',
  code: '',
};

const createEmptySerialDraft = (): SerialDraft => ({
  date: today,
  documentNo: '',
  customerName: '',
  productCode: '',
  model: '',
  trackingCode: '',
  serialNo: '',
  movement: 'ورود',
});

const seedModels: ProductModel[] = [
  {
    id: 'model-1',
    model: 'BRH-09TP',
    productCode: '2800003908970',
    warrantyCode: '0',
    createdAt: '۱۴۰۲/۰۵/۰۵',
    updatedAt: '۱۴۰۲/۰۵/۰۵',
    status: 'فعال',
  },
  {
    id: 'model-2',
    model: 'BTC-30AK',
    productCode: '280000399052',
    warrantyCode: '0',
    createdAt: '۱۴۰۲/۰۴/۱۴',
    updatedAt: '۱۴۰۲/۰۴/۱۴',
    status: 'فعال',
  },
  {
    id: 'model-3',
    model: 'BID-36H',
    productCode: '280000565651',
    warrantyCode: '0',
    createdAt: '۱۴۰۲/۰۴/۱۴',
    updatedAt: '۱۴۰۲/۰۴/۱۴',
    status: 'فعال',
  },
];

const seedSerials: SerialRecord[] = [
  {
    id: 'serial-1',
    date: '۱۴۰۲/۰۴/۱۴',
    documentNo: '1001',
    customerName: 'انبار مرکزی',
    productCode: '2800003908970',
    model: 'BRH-09TP',
    trackingCode: 'TR-1001',
    serialNo: '2800003908970-001',
    movement: 'ورود',
    createdAt: '۱۴۰۲/۰۴/۱۴',
    createdBy: 'admin',
    updatedAt: '۱۴۰۲/۰۴/۱۴',
    updatedBy: 'admin',
    status: 'ثبت شده',
  },
  {
    id: 'serial-2',
    date: '۱۴۰۲/۰۴/۱۴',
    documentNo: '1002',
    customerName: 'انبار مرکزی',
    productCode: '280000399052',
    model: 'BTC-30AK',
    trackingCode: 'TR-1002',
    serialNo: '280000399052-002',
    movement: 'خروج',
    createdAt: '۱۴۰۲/۰۴/۱۴',
    createdBy: 'admin',
    updatedAt: '۱۴۰۲/۰۴/۱۴',
    updatedBy: 'admin',
    status: 'خروج شده',
  },
];

const seedLocations: LocationSummary[] = [
  { id: 'location-main', name: 'انبار مرکزی', code: 'MAIN', count: 2, isActive: true },
  { id: 'location-receive', name: 'محوطه دریافت', code: 'RECEIVE', count: 0, isActive: true },
  { id: 'location-qc', name: 'کنترل کیفیت', code: 'QC', count: 0, isActive: true },
  { id: 'location-ready', name: 'آماده ارسال', code: 'READY', count: 0, isActive: true },
];

const menuItems: Array<{ id: ViewId; label: string; icon: ReactNode }> = [
  { id: 'serial-list', label: 'لیست سریال', icon: <BadgeOutlined /> },
  { id: 'product-new', label: 'تعریف کالا', icon: <Inventory2Outlined /> },
  { id: 'product-list', label: 'لیست مدل کالا', icon: <TableRowsOutlined /> },
];

const pageSizeOptions = [20, 50, 100];

const scanModeOptions: Array<{ id: ScanMode; label: string }> = [
  { id: 'inbound', label: 'ورود' },
  { id: 'outbound', label: 'خروج' },
  { id: 'lookup', label: 'استعلام' },
];

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function readLoginState() {
  if (typeof window === 'undefined') {
    return false;
  }

  if (new URLSearchParams(window.location.search).get('loggedIn') === '1') {
    return true;
  }

  if (window.document.cookie.split('; ').includes('barcode-app-login=true')) {
    return true;
  }

  return readStorage('barcode-app-login', false);
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

export default function Home() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>('serial-list');
  const [models, setModels] = useState<ProductModel[]>(seedModels);
  const [serials, setSerials] = useState<SerialRecord[]>(seedSerials);
  const [locations, setLocations] = useState<LocationSummary[]>(seedLocations);
  const [dataSource, setDataSource] = useState<'sample' | 'database'>('sample');
  const [statusMessage, setStatusMessage] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [serialSearch, setSerialSearch] = useState('');
  const [modelPage, setModelPage] = useState(1);
  const [modelPageSize, setModelPageSize] = useState(20);
  const [serialPage, setSerialPage] = useState(1);
  const [serialPageSize, setSerialPageSize] = useState(20);
  const [scanMode, setScanMode] = useState<ScanMode>('inbound');
  const [scanValue, setScanValue] = useState('');
  const [scanContext, setScanContext] = useState<ScanContext>({
    model: null,
    trackingCode: '',
  });
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [isScanBusy, setIsScanBusy] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const modalSerialInputRef = useRef<HTMLInputElement>(null);

  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin' });
  const [productDialog, setProductDialog] = useState<{
    mode: 'create' | 'edit';
    draft: ProductDraft;
  } | null>(null);
  const [serialDialog, setSerialDialog] = useState<{
    mode: 'create' | 'edit';
    draft: SerialDraft;
  } | null>(null);
  const [locationDialog, setLocationDialog] = useState<{
    mode: 'create' | 'edit';
    draft: LocationDraft;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);

  const applyBootstrapData = useCallback((data: BootstrapData) => {
    setModels(data.models.length > 0 ? data.models : seedModels);
    setSerials(data.serials.length > 0 ? data.serials : seedSerials);
    setLocations(data.locations.length > 0 ? data.locations : seedLocations);
    setDataSource('database');
  }, []);

  const loadBootstrapData = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch('/api/bootstrap', {
        cache: 'no-store',
        signal,
      });

      if (!response.ok) {
        throw new Error(`Bootstrap request failed with ${response.status}`);
      }

      applyBootstrapData((await response.json()) as BootstrapData);
    },
    [applyBootstrapData],
  );

  useEffect(() => {
    const loggedIn = readLoginState();

    if (loggedIn) {
      window.localStorage.setItem('barcode-app-login', JSON.stringify(true));
      window.document.cookie = 'barcode-app-login=true; path=/; max-age=2592000; samesite=lax';
    }

    const timeout = window.setTimeout(() => {
      setIsLoggedIn(loggedIn);
      setHasHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const controller = new AbortController();

    async function loadData() {
      try {
        await loadBootstrapData(controller.signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setModels(readStorage('barcode-app-models', seedModels));
        setSerials(readStorage('barcode-app-serials', seedSerials));
        setLocations(readStorage('barcode-app-locations', seedLocations));
        setDataSource('sample');
      }
    }

    void loadData();

    return () => controller.abort();
  }, [hasHydrated, loadBootstrapData]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem('barcode-app-models', JSON.stringify(models));
  }, [hasHydrated, models]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem('barcode-app-serials', JSON.stringify(serials));
  }, [hasHydrated, serials]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem('barcode-app-locations', JSON.stringify(locations));
  }, [hasHydrated, locations]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem('barcode-app-login', JSON.stringify(isLoggedIn));
    window.document.cookie = `barcode-app-login=${isLoggedIn ? 'true' : ''}; path=/; max-age=${
      isLoggedIn ? 2592000 : 0
    }; samesite=lax`;
  }, [hasHydrated, isLoggedIn]);

  const isSerialDialogOpen = serialDialog !== null;

  useEffect(() => {
    if (isSerialDialogOpen) {
      modalSerialInputRef.current?.focus();
    }
  }, [isSerialDialogOpen]);

  useEffect(() => {
    if (activeView === 'serial-new' && isLoggedIn && !isSerialDialogOpen) {
      scanInputRef.current?.focus();
    }
  }, [activeView, isLoggedIn, isSerialDialogOpen]);

  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    if (!query) {
      return models;
    }

    return models.filter((item) =>
      [item.model, item.productCode, item.warrantyCode, item.status].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [modelSearch, models]);

  const filteredSerials = useMemo(() => {
    const query = serialSearch.trim().toLowerCase();
    if (!query) {
      return serials;
    }

    return serials.filter((item) =>
      [item.documentNo, item.customerName].some((value) => value.toLowerCase().includes(query)),
    );
  }, [serialSearch, serials]);

  const modelTotalPages = Math.max(1, Math.ceil(filteredModels.length / modelPageSize));
  const serialTotalPages = Math.max(1, Math.ceil(filteredSerials.length / serialPageSize));
  const safeModelPage = Math.min(modelPage, modelTotalPages);
  const safeSerialPage = Math.min(serialPage, serialTotalPages);
  const modelPageStart = (safeModelPage - 1) * modelPageSize;
  const serialPageStart = (safeSerialPage - 1) * serialPageSize;

  const paginatedModels = useMemo(
    () => filteredModels.slice(modelPageStart, modelPageStart + modelPageSize),
    [filteredModels, modelPageSize, modelPageStart],
  );

  const paginatedSerials = useMemo(
    () => filteredSerials.slice(serialPageStart, serialPageStart + serialPageSize),
    [filteredSerials, serialPageSize, serialPageStart],
  );

  const stats = useMemo(() => {
    const inbound = serials.filter((item) => item.movement === 'ورود').length;
    const outbound = serials.filter((item) => item.movement === 'خروج').length;

    return {
      models: models.length,
      serials: serials.length,
      inbound,
      outbound,
    };
  }, [models.length, serials]);

  const openProductCreate = () => {
    setProductDialog({ mode: 'create', draft: emptyProductDraft });
  };

  const openSerialCreate = () => {
    setSerialDialog({ mode: 'create', draft: createEmptySerialDraft() });
  };

  const openLocationCreate = () => {
    setLocationDialog({ mode: 'create', draft: emptyLocationDraft });
  };

  const handleMenuClick = (id: ViewId) => {
    if (id === 'product-new') {
      openProductCreate();
      return;
    }

    setActiveView(id);
  };

  const login = () => {
    window.localStorage.setItem('barcode-app-login', JSON.stringify(true));
    window.document.cookie = 'barcode-app-login=true; path=/; max-age=2592000; samesite=lax';
    setIsLoggedIn(true);
  };

  const logout = () => {
    window.localStorage.removeItem('barcode-app-login');
    window.document.cookie = 'barcode-app-login=; path=/; max-age=0; samesite=lax';
    setIsLoggedIn(false);
  };

  const submitScan = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const formBarcode =
      event?.currentTarget instanceof HTMLFormElement
        ? (new FormData(event.currentTarget).get('barcode')?.toString() ?? '')
        : '';

    const barcode = (formBarcode || scanValue).trim();

    if (!barcode || isScanBusy) {
      return;
    }

    setIsScanBusy(true);

    try {
      const data = await apiRequest<ScanResponse>('/api/scans', {
        body: JSON.stringify({
          barcode,
          mode: scanMode,
          model: scanContext.model?.model ?? '',
          productCode: scanContext.model?.productCode ?? '',
          trackingCode: scanContext.trackingCode,
        }),
        method: 'POST',
      });

      setScanResult(data);
      setScanValue('');
      setStatusMessage(data.message);

      if (data.action === 'PRODUCT_SELECTED' && data.matchedModel) {
        setScanContext((current) => ({
          ...current,
          model: data.matchedModel,
        }));
      }

      if (data.action === 'TRACKING_SELECTED' && data.matchedModel) {
        setScanContext({
          model: data.matchedModel,
          trackingCode: data.trackingCode ?? barcode,
        });
      }

      if (
        data.serial &&
        (data.action === 'INBOUND_CREATED' || data.action === 'OUTBOUND_CREATED')
      ) {
        setSerials((current) => [data.serial as SerialRecord, ...current]);
        setSerialPage(1);
        setScanContext((current) => ({ ...current, trackingCode: '' }));
        void loadBootstrapData();
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'ثبت اسکن ناموفق بود.');
    } finally {
      setIsScanBusy(false);
      window.requestAnimationFrame(() => scanInputRef.current?.focus());
    }
  };

  const saveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productDialog) {
      return;
    }

    const draft = productDialog.draft;
    if (!draft.model.trim() || !draft.productCode.trim()) {
      return;
    }

    try {
      const data =
        productDialog.mode === 'create'
          ? await apiRequest<ProductModelResponse>('/api/product-models', {
              body: JSON.stringify(draft),
              method: 'POST',
            })
          : await apiRequest<ProductModelResponse>(`/api/product-models/${draft.id}`, {
              body: JSON.stringify(draft),
              method: 'PATCH',
            });

      setModels((current) =>
        productDialog.mode === 'create'
          ? [data.model, ...current]
          : current.map((item) => (item.id === data.model.id ? data.model : item)),
      );
      setProductDialog(null);
      setActiveView('product-list');
      setStatusMessage(
        productDialog.mode === 'create' ? 'مدل کالا ذخیره شد.' : 'مدل کالا ویرایش شد.',
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'ذخیره مدل کالا ناموفق بود.');
    }
  };

  const updateModel = (item: ProductModel) => {
    setProductDialog({
      mode: 'edit',
      draft: {
        id: item.id,
        model: item.model,
        productCode: item.productCode,
        warrantyCode: item.warrantyCode,
      },
    });
  };

  const deleteModel = async (id: string) => {
    setConfirmDialog({
      title: 'حذف مدل کالا',
      message: 'این مدل کالا از پایگاه داده حذف شود؟',
      confirmLabel: 'حذف مدل',
      onConfirm: async () => {
        await apiRequest<{ ok: boolean }>(`/api/product-models/${id}`, { method: 'DELETE' });
        setModels((current) => current.filter((model) => model.id !== id));
        setStatusMessage('مدل کالا حذف شد.');
      },
    });
  };

  const saveSerial = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!serialDialog) {
      return;
    }

    const draft = serialDialog.draft;
    if (!draft.serialNo.trim()) {
      return;
    }

    const matchedModel = models.find(
      (item) =>
        item.productCode === draft.productCode.trim() ||
        draft.serialNo.includes(item.productCode) ||
        item.model === draft.model.trim(),
    );

    try {
      const payload = {
        ...draft,
        productCode: draft.productCode.trim() || matchedModel?.productCode || '',
        model: draft.model.trim() || matchedModel?.model || '',
      };
      const data =
        serialDialog.mode === 'create'
          ? await apiRequest<SerialRecordResponse>('/api/serial-records', {
              body: JSON.stringify(payload),
              method: 'POST',
            })
          : await apiRequest<SerialRecordResponse>(`/api/serial-records/${draft.id}`, {
              body: JSON.stringify(payload),
              method: 'PATCH',
            });

      setSerials((current) =>
        serialDialog.mode === 'create'
          ? [data.serial, ...current]
          : current.map((item) => (item.id === data.serial.id ? data.serial : item)),
      );
      setSerialDialog(null);
      setStatusMessage(serialDialog.mode === 'create' ? 'سریال ذخیره شد.' : 'سریال ویرایش شد.');
      void loadBootstrapData();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'ذخیره سریال ناموفق بود.');
    }
  };

  const preventModalEnterSubmit = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
    }
  };

  const updateSerial = (item: SerialRecord) => {
    setSerialDialog({
      mode: 'edit',
      draft: {
        id: item.id,
        date: item.date,
        documentNo: item.documentNo,
        customerName: item.customerName,
        productCode: item.productCode,
        model: item.model,
        trackingCode: item.trackingCode,
        serialNo: item.serialNo,
        movement: item.movement,
        status: item.status,
      },
    });
  };

  const deleteSerial = async (id: string) => {
    setConfirmDialog({
      title: 'حذف سریال',
      message: 'این سریال از پایگاه داده حذف شود؟',
      confirmLabel: 'حذف سریال',
      onConfirm: async () => {
        await apiRequest<{ ok: boolean }>(`/api/serial-records/${id}`, { method: 'DELETE' });
        setSerials((current) => current.filter((serial) => serial.id !== id));
        setStatusMessage('سریال حذف شد.');
        void loadBootstrapData();
      },
    });
  };

  const saveLocation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!locationDialog) {
      return;
    }

    const draft = locationDialog.draft;
    if (!draft.name.trim() || !draft.code.trim()) {
      return;
    }

    try {
      const data =
        locationDialog.mode === 'create'
          ? await apiRequest<LocationResponse>('/api/locations', {
              body: JSON.stringify(draft),
              method: 'POST',
            })
          : await apiRequest<LocationResponse>(`/api/locations/${draft.id}`, {
              body: JSON.stringify(draft),
              method: 'PATCH',
            });

      setLocations((current) =>
        locationDialog.mode === 'create'
          ? [...current, data.location]
          : current.map((item) => (item.id === data.location.id ? data.location : item)),
      );
      setLocationDialog(null);
      setStatusMessage(
        locationDialog.mode === 'create' ? 'محل کالا ذخیره شد.' : 'محل کالا ویرایش شد.',
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'ذخیره محل کالا ناموفق بود.');
    }
  };

  const confirmDelete = async () => {
    if (!confirmDialog) {
      return;
    }

    try {
      await confirmDialog.onConfirm();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'حذف اطلاعات ناموفق بود.');
    } finally {
      setConfirmDialog(null);
    }
  };

  const exportCsv = (type: 'models' | 'serials') => {
    if (type === 'serials') {
      downloadSerialExcelFile(
        filteredSerials.map((item) => ({
          date: item.date,
          documentNo: item.documentNo,
          customerName: item.customerName,
          productCode: item.productCode,
          model: item.model,
          trackingCode: item.trackingCode,
          serialNo: item.serialNo,
        })),
        `serials-${Date.now()}`,
      );
      return;
    }

    const rows = filteredModels.map((item, index) => ({
      '#': index + 1,
      model: item.model,
      productCode: item.productCode,
      warrantyCode: item.warrantyCode,
      createdAt: item.createdAt,
      status: item.status,
    }));

    const csv = [
      Object.keys(rows[0] ?? { empty: '' }).join(','),
      ...rows.map((row) => Object.values(row).join(',')),
    ].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isLoggedIn) {
    return (
      <main className="login-shell" dir="rtl">
        <section className="login-card" aria-label="ورود به برنامه انبار">
          <div className="login-visual" aria-hidden="true">
            <span className="shape shape-one" />
            <span className="shape shape-two" />
            <span className="shape shape-three" />
            <div className="monitor">
              <div className="monitor-screen">
                <BadgeOutlined />
              </div>
              <div className="monitor-base" />
            </div>
          </div>

          <form
            action="/api/login"
            className="login-form"
            method="post"
            onSubmit={() => {
              login();
            }}
          >
            <label className="field with-icon">
              <span>نام کاربری</span>
              <LoginOutlined />
              <input
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, username: event.target.value }))
                }
                autoComplete="username"
              />
            </label>
            <label className="field with-icon">
              <span>رمز عبور</span>
              <BadgeOutlined />
              <input
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
                type="password"
                autoComplete="current-password"
              />
            </label>
            <button className="primary-button login-button" onClick={login} type="submit">
              ورود
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell" dir="rtl">
      <aside className="sidebar" aria-label="منوی اصلی">
        <div className="brand">
          <div>
            <strong>زرین نمای کاسپین</strong>
            <span>سامانه انبار و سریال</span>
          </div>
          <QrCodeScanner />
        </div>

        <nav className="nav-list">
          {menuItems.map((item) => (
            <button
              className={activeView === item.id ? 'nav-item active' : 'nav-item'}
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="user-line">
            <DashboardOutlined />
            <span>کاربر جاری: admin</span>
          </div>
          <form action="/api/logout" method="post">
            <button className="ghost-button" onClick={logout} type="submit">
              <Logout />
              خروج
            </button>
          </form>
        </header>

        <section className="stats-grid" aria-label="خلاصه وضعیت انبار">
          <StatCard label="مدل کالا" value={stats.models} tone="blue" />
          <StatCard label="کل سریال" value={stats.serials} tone="green" />
          <StatCard label="ورودی" value={stats.inbound} tone="emerald" />
          <StatCard label="خروجی" value={stats.outbound} tone="rose" />
        </section>

        {statusMessage && <p className="status-message">{statusMessage}</p>}

        {activeView === 'serial-new' && (
          <ContentPanel
            title="اسکن بارکد"
            subtitle="ثبت سریع ورود، خروج و استعلام"
            action={
              <button className="secondary-button" onClick={() => setActiveView('serial-list')}>
                مشاهده لیست
              </button>
            }
          >
            <section className="scanner-panel">
              <div className="scanner-mode-group" aria-label="نوع عملیات اسکن">
                {scanModeOptions.map((option) => (
                  <button
                    className={scanMode === option.id ? 'scanner-mode active' : 'scanner-mode'}
                    key={option.id}
                    onClick={() => {
                      setScanMode(option.id);
                      scanInputRef.current?.focus();
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {(scanContext.model || scanContext.trackingCode) && (
                <article className="scan-result context">
                  <div>
                    <span>آماده برای ثبت سریال</span>
                    <strong>{scanContext.model?.model ?? 'مدل انتخاب نشده'}</strong>
                  </div>
                  <div className="scan-result-grid">
                    <RecordField label="شناسه کالا" value={scanContext.model?.productCode || '-'} />
                    <RecordField label="کد رهگیری" value={scanContext.trackingCode || '-'} />
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => setScanContext({ model: null, trackingCode: '' })}
                    type="button"
                  >
                    پاک کردن
                  </button>
                </article>
              )}

              <form className="scanner-form" onSubmit={submitScan}>
                <label className="scanner-input-wrap">
                  <span>بارکد</span>
                  <QrCodeScanner />
                  <input
                    ref={scanInputRef}
                    name="barcode"
                    value={scanValue}
                    onChange={(event) => setScanValue(event.target.value)}
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    inputMode="none"
                    placeholder="اسکن..."
                  />
                </label>
                <button className="primary-button" disabled={isScanBusy} type="submit">
                  <QrCodeScanner />
                  {isScanBusy ? 'در حال ثبت' : 'ثبت اسکن'}
                </button>
              </form>

              {scanResult && (
                <article
                  className={`scan-result ${scanResult.action === 'NOT_FOUND' ? 'warn' : ''}`}
                >
                  <div>
                    <span>آخرین اسکن</span>
                    <strong>{scanResult.barcode}</strong>
                  </div>
                  <p>{scanResult.message}</p>
                  {scanResult.serial && (
                    <div className="scan-result-grid">
                      <RecordField label="شماره سریال" value={scanResult.serial.serialNo} />
                      <RecordField label="مدل کالا" value={scanResult.serial.model || '-'} />
                      <RecordField
                        label="شناسه کالا"
                        value={scanResult.serial.productCode || '-'}
                      />
                      <RecordField label="نوع" value={scanResult.serial.movement} />
                    </div>
                  )}
                  {!scanResult.serial && scanResult.matchedModel && (
                    <div className="scan-result-grid">
                      <RecordField label="مدل کالا" value={scanResult.matchedModel.model} />
                      <RecordField label="شناسه کالا" value={scanResult.matchedModel.productCode} />
                    </div>
                  )}
                </article>
              )}

              <div className="scanner-secondary-actions">
                <button className="secondary-button" onClick={openSerialCreate} type="button">
                  <Add />
                  ثبت دستی
                </button>
                <button
                  className="ghost-panel-button"
                  onClick={() => setActiveView('serial-list')}
                  type="button"
                >
                  لیست سریال‌ها
                </button>
              </div>
            </section>
          </ContentPanel>
        )}

        {activeView === 'serial-list' && (
          <ContentPanel
            title="لیست سریال‌ها"
            subtitle="ردیابی ورود و خروج کالا"
            action={
              <button className="accent-button" onClick={openSerialCreate} type="button">
                <Add />
                سریال جدید
              </button>
            }
          >
            <Toolbar
              exportLabel="فایل اکسل"
              onExport={() => exportCsv('serials')}
              onSearch={(value) => {
                setSerialSearch(value);
                setSerialPage(1);
              }}
              placeholder="نام مشتری یا شماره سند..."
              search={serialSearch}
            />
            <div className="table-options">
              <PageSizeControl
                onPageSizeChange={(value) => {
                  setSerialPageSize(value);
                  setSerialPage(1);
                }}
                pageSize={serialPageSize}
              />
            </div>
            <div className="table-wrap serial-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>تاریخ</th>
                    <th>شماره سند</th>
                    <th>نام مشتری</th>
                    <th>شناسه کالا</th>
                    <th>مدل کالا</th>
                    <th>کد رهگیری</th>
                    <th>شماره سریال</th>
                    <th>تاریخ ایجاد</th>
                    <th>ایجاد کننده</th>
                    <th>تاریخ ویرایش</th>
                    <th>ویرایش کننده</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSerials.map((item, index) => (
                    <tr key={item.id}>
                      <td>{serialPageStart + index + 1}</td>
                      <td>{item.date}</td>
                      <td>{item.documentNo || '-'}</td>
                      <td>{item.customerName}</td>
                      <td>{item.productCode || '-'}</td>
                      <td>{item.model || '-'}</td>
                      <td>{item.trackingCode || '-'}</td>
                      <td>{item.serialNo}</td>
                      <td>{item.createdAt || '-'}</td>
                      <td>{item.createdBy || '-'}</td>
                      <td>{item.updatedAt || '-'}</td>
                      <td>{item.updatedBy || '-'}</td>
                      <td>
                        <StatusPill tone={item.status === 'ثبت شده' ? 'green' : 'orange'}>
                          {item.status}
                        </StatusPill>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="mini-button orange"
                            onClick={() => updateSerial(item)}
                            type="button"
                          >
                            <EditOutlined />
                            ویرایش
                          </button>
                          <button
                            className="mini-button red"
                            onClick={() => deleteSerial(item.id)}
                            type="button"
                          >
                            <Delete />
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-record-list" aria-label="لیست سریال‌ها">
              {paginatedSerials.length > 0 ? (
                paginatedSerials.map((item, index) => (
                  <article className="record-card" key={item.id}>
                    <div className="record-card-header">
                      <strong>{item.serialNo}</strong>
                      <span>#{(serialPageStart + index + 1).toLocaleString('fa-IR')}</span>
                    </div>
                    <div className="record-card-grid">
                      <RecordField label="تاریخ" value={item.date} />
                      <RecordField label="شماره سند" value={item.documentNo || '-'} />
                      <RecordField label="نام مشتری" value={item.customerName || '-'} />
                      <RecordField label="شناسه کالا" value={item.productCode || '-'} />
                      <RecordField label="مدل کالا" value={item.model || '-'} />
                      <RecordField label="کد رهگیری" value={item.trackingCode || '-'} />
                      <RecordField label="تاریخ ایجاد" value={item.createdAt || '-'} />
                      <RecordField label="ایجاد کننده" value={item.createdBy || '-'} />
                      <RecordField label="تاریخ ویرایش" value={item.updatedAt || '-'} />
                      <RecordField label="ویرایش کننده" value={item.updatedBy || '-'} />
                    </div>
                    <div className="record-card-footer">
                      <StatusPill tone={item.status === 'ثبت شده' ? 'green' : 'orange'}>
                        {item.status}
                      </StatusPill>
                      <div className="row-actions">
                        <button
                          className="mini-button orange"
                          onClick={() => updateSerial(item)}
                          type="button"
                        >
                          <EditOutlined />
                          ویرایش
                        </button>
                        <button
                          className="mini-button red"
                          onClick={() => deleteSerial(item.id)}
                          type="button"
                        >
                          <Delete />
                          حذف
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-records">رکوردی برای نمایش وجود ندارد.</p>
              )}
            </div>
            <PaginationSummary
              filteredTotal={filteredSerials.length}
              onPageChange={setSerialPage}
              page={safeSerialPage}
              pageSize={serialPageSize}
              total={serials.length}
            />
          </ContentPanel>
        )}

        {activeView === 'product-new' && (
          <ContentPanel
            title="تعریف کالای جدید"
            subtitle="ثبت مدل و شناسه کالا از طریق فرم سریع"
            action={
              <button className="secondary-button" onClick={() => setActiveView('product-list')}>
                مشاهده لیست
              </button>
            }
          >
            <div className="empty-action compact-empty">
              <Inventory2Outlined />
              <strong>فرم تعریف کالا در پنجره جداگانه باز می‌شود.</strong>
              <button className="primary-button" onClick={openProductCreate} type="button">
                <Add />
                مدل جدید
              </button>
            </div>
          </ContentPanel>
        )}

        {activeView === 'product-list' && (
          <ContentPanel
            title="لیست مدل کالا"
            subtitle="مدیریت مدل‌ها و شناسه‌های کالا"
            action={
              <button className="accent-button" onClick={openProductCreate} type="button">
                <Add />
                مدل جدید
              </button>
            }
          >
            <Toolbar
              onExport={() => exportCsv('models')}
              onSearch={(value) => {
                setModelSearch(value);
                setModelPage(1);
              }}
              search={modelSearch}
            />
            <div className="table-options">
              <PageSizeControl
                onPageSizeChange={(value) => {
                  setModelPageSize(value);
                  setModelPage(1);
                }}
                pageSize={modelPageSize}
              />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>مدل</th>
                    <th>شناسه کالا</th>
                    <th>شناسه گارانتی</th>
                    <th>تاریخ ایجاد</th>
                    <th>تاریخ ویرایش</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedModels.map((item, index) => (
                    <tr key={item.id}>
                      <td>{modelPageStart + index + 1}</td>
                      <td>{item.model}</td>
                      <td>{item.productCode}</td>
                      <td>{item.warrantyCode}</td>
                      <td>{item.createdAt}</td>
                      <td>{item.updatedAt}</td>
                      <td>
                        <StatusPill tone="green">ثبت شده</StatusPill>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="mini-button orange"
                            onClick={() => updateModel(item)}
                            type="button"
                          >
                            <EditOutlined />
                            ویرایش
                          </button>
                          <button
                            className="mini-button red"
                            onClick={() => deleteModel(item.id)}
                            type="button"
                          >
                            <Delete />
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-record-list" aria-label="لیست مدل کالا">
              {paginatedModels.length > 0 ? (
                paginatedModels.map((item, index) => (
                  <article className="record-card" key={item.id}>
                    <div className="record-card-header">
                      <strong>{item.model}</strong>
                      <span>#{(modelPageStart + index + 1).toLocaleString('fa-IR')}</span>
                    </div>
                    <div className="record-card-grid">
                      <RecordField label="شناسه کالا" value={item.productCode} />
                      <RecordField label="شناسه گارانتی" value={item.warrantyCode || '-'} />
                      <RecordField label="تاریخ ایجاد" value={item.createdAt} />
                      <RecordField label="تاریخ ویرایش" value={item.updatedAt} />
                    </div>
                    <div className="record-card-footer">
                      <StatusPill tone="green">ثبت شده</StatusPill>
                      <div className="row-actions">
                        <button
                          className="mini-button orange"
                          onClick={() => updateModel(item)}
                          type="button"
                        >
                          <EditOutlined />
                          ویرایش
                        </button>
                        <button
                          className="mini-button red"
                          onClick={() => deleteModel(item.id)}
                          type="button"
                        >
                          <Delete />
                          حذف
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-records">رکوردی برای نمایش وجود ندارد.</p>
              )}
            </div>
            <PaginationSummary
              filteredTotal={filteredModels.length}
              onPageChange={setModelPage}
              page={safeModelPage}
              pageSize={modelPageSize}
              total={models.length}
            />
          </ContentPanel>
        )}

        {activeView === 'locations' && (
          <ContentPanel
            title="لیست محل کالا"
            subtitle={
              dataSource === 'database'
                ? 'اطلاعات نمونه از barcode_app_sample'
                : 'نمای سریع محل‌های انبار'
            }
            action={
              <button className="accent-button" onClick={openLocationCreate} type="button">
                <Add />
                محل جدید
              </button>
            }
          >
            <div className="location-grid">
              {locations.map((location) => (
                <article className="location-card" key={location.id}>
                  <ArchiveOutlined />
                  <div>
                    <strong>{location.name}</strong>
                    <span>
                      {location.count.toLocaleString('fa-IR')} قلم کالا / {location.code}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </ContentPanel>
        )}
      </section>

      {productDialog && (
        <Modal
          title={productDialog.mode === 'create' ? 'تعریف کالای جدید' : 'ویرایش مدل کالا'}
          subtitle="مدل، شناسه کالا و شناسه گارانتی را وارد کنید."
          onClose={() => setProductDialog(null)}
        >
          <form className="modal-form" onSubmit={saveProduct}>
            <TextField
              label="مدل"
              value={productDialog.draft.model}
              onChange={(value) =>
                setProductDialog((current) =>
                  current ? { ...current, draft: { ...current.draft, model: value } } : current,
                )
              }
            />
            <TextField
              label="شناسه کالا"
              value={productDialog.draft.productCode}
              onChange={(value) =>
                setProductDialog((current) =>
                  current
                    ? { ...current, draft: { ...current.draft, productCode: value } }
                    : current,
                )
              }
            />
            <TextField
              label="شناسه گارانتی"
              value={productDialog.draft.warrantyCode}
              onChange={(value) =>
                setProductDialog((current) =>
                  current
                    ? { ...current, draft: { ...current.draft, warrantyCode: value } }
                    : current,
                )
              }
            />
            <ModalActions
              confirmLabel={productDialog.mode === 'create' ? 'ایجاد مدل' : 'ذخیره تغییرات'}
              onCancel={() => setProductDialog(null)}
            />
          </form>
        </Modal>
      )}

      {serialDialog && (
        <Modal
          title={serialDialog.mode === 'create' ? 'سریال جدید' : 'ویرایش سریال'}
          subtitle="برای اسکن سریع، فیلد شماره سریال آماده ورود است."
          onClose={() => setSerialDialog(null)}
          wide
        >
          <form
            className="modal-form modal-form-wide"
            onKeyDown={preventModalEnterSubmit}
            onSubmit={saveSerial}
          >
            <PersianDateField
              label="تاریخ"
              value={serialDialog.draft.date}
              onChange={(value) =>
                setSerialDialog((current) =>
                  current ? { ...current, draft: { ...current.draft, date: value } } : current,
                )
              }
            />
            <TextField
              label="شماره سند"
              value={serialDialog.draft.documentNo}
              onChange={(value) =>
                setSerialDialog((current) =>
                  current
                    ? { ...current, draft: { ...current.draft, documentNo: value } }
                    : current,
                )
              }
            />
            <TextField
              label="نام مشتری"
              value={serialDialog.draft.customerName}
              onChange={(value) =>
                setSerialDialog((current) =>
                  current
                    ? { ...current, draft: { ...current.draft, customerName: value } }
                    : current,
                )
              }
            />
            <TextField
              label="شناسه کالا"
              value={serialDialog.draft.productCode}
              onChange={(value) =>
                setSerialDialog((current) =>
                  current
                    ? { ...current, draft: { ...current.draft, productCode: value } }
                    : current,
                )
              }
            />
            <TextField
              label="مدل کالا"
              value={serialDialog.draft.model}
              onChange={(value) =>
                setSerialDialog((current) =>
                  current ? { ...current, draft: { ...current.draft, model: value } } : current,
                )
              }
            />
            <TextField
              label="کد رهگیری"
              value={serialDialog.draft.trackingCode}
              onChange={(value) =>
                setSerialDialog((current) =>
                  current
                    ? { ...current, draft: { ...current.draft, trackingCode: value } }
                    : current,
                )
              }
            />
            <TextField
              inputRef={modalSerialInputRef}
              label="شماره سریال"
              value={serialDialog.draft.serialNo}
              onChange={(value) =>
                setSerialDialog((current) =>
                  current ? { ...current, draft: { ...current.draft, serialNo: value } } : current,
                )
              }
              placeholder="اسکن بارکد..."
              wide
            />
            <label className="field">
              <span>نوع عملیات</span>
              <select
                value={serialDialog.draft.movement}
                onChange={(event) =>
                  setSerialDialog((current) =>
                    current
                      ? {
                          ...current,
                          draft: {
                            ...current.draft,
                            movement: event.target.value as MovementType,
                          },
                        }
                      : current,
                  )
                }
              >
                <option>ورود</option>
                <option>خروج</option>
              </select>
            </label>
            <ModalActions
              confirmLabel={serialDialog.mode === 'create' ? 'ثبت سریال' : 'ذخیره تغییرات'}
              onCancel={() => setSerialDialog(null)}
            />
          </form>
        </Modal>
      )}

      {locationDialog && (
        <Modal
          title={locationDialog.mode === 'create' ? 'محل جدید' : 'ویرایش محل کالا'}
          subtitle="نام و کد محل کالا را وارد کنید."
          onClose={() => setLocationDialog(null)}
        >
          <form className="modal-form" onSubmit={saveLocation}>
            <TextField
              label="نام محل"
              value={locationDialog.draft.name}
              onChange={(value) =>
                setLocationDialog((current) =>
                  current ? { ...current, draft: { ...current.draft, name: value } } : current,
                )
              }
            />
            <TextField
              label="کد محل"
              value={locationDialog.draft.code}
              onChange={(value) =>
                setLocationDialog((current) =>
                  current
                    ? { ...current, draft: { ...current.draft, code: value.toUpperCase() } }
                    : current,
                )
              }
            />
            <ModalActions
              confirmLabel={locationDialog.mode === 'create' ? 'ایجاد محل' : 'ذخیره تغییرات'}
              onCancel={() => setLocationDialog(null)}
            />
          </form>
        </Modal>
      )}

      {confirmDialog && (
        <Modal
          title={confirmDialog.title}
          subtitle={confirmDialog.message}
          onClose={() => setConfirmDialog(null)}
        >
          <div className="confirm-actions">
            <button
              className="secondary-button"
              onClick={() => setConfirmDialog(null)}
              type="button"
            >
              انصراف
            </button>
            <button className="danger-button" onClick={confirmDelete} type="button">
              <Delete />
              {confirmDialog.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal({
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
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className={wide ? 'modal-card wide' : 'modal-card'}
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ModalActions({ confirmLabel, onCancel }: { confirmLabel: string; onCancel: () => void }) {
  return (
    <div className="modal-actions">
      <button className="secondary-button" onClick={onCancel} type="button">
        انصراف
      </button>
      <button className="primary-button" type="submit">
        <Add />
        {confirmLabel}
      </button>
    </div>
  );
}

function PersianDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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
    <label className="field date-field">
      <span>{label}</span>
      <button
        className={isOpen ? 'date-trigger active' : 'date-trigger'}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <CalendarMonthOutlined />
        <span>{value || today}</span>
      </button>
      {isOpen && (
        <div className="persian-calendar">
          <div className="calendar-header">
            <button onClick={() => changeMonth(-1)} type="button">
              ‹
            </button>
            <strong>
              {persianMonthNames[visibleMonth.month - 1]} {visibleMonth.year}
            </strong>
            <button onClick={() => changeMonth(1)} type="button">
              ›
            </button>
          </div>
          <div className="calendar-weekdays">
            {persianWeekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-days">
            {Array.from({ length: leadingCells }).map((_, index) => (
              <span className="calendar-empty" key={`empty-${index}`} />
            ))}
            {monthDates.map(({ parts }) => {
              const dateValue = formatPersianDateParts(parts);

              return (
                <button
                  className={dateValue === selectedValue ? 'selected' : ''}
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
            className="calendar-today"
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

function TextField({
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
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function ContentPanel({
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
    <section className="content-panel">
      <div className="panel-heading">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString('fa-IR')}</strong>
    </article>
  );
}

function Toolbar({
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
    <div className="table-toolbar">
      <div className="export-actions">
        <button className="success-button" type="button">
          <Upload />
          کپی
        </button>
        <button className="success-button" onClick={onExport} type="button">
          <Download />
          {exportLabel}
        </button>
      </div>
      <label className="search-box">
        <Search />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
        />
      </label>
    </div>
  );
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'green' | 'orange' }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function RecordField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="record-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PageSizeControl({
  onPageSizeChange,
  pageSize,
}: {
  onPageSizeChange: (pageSize: number) => void;
  pageSize: number;
}) {
  return (
    <label className="page-size-control">
      <span>ردیف در هر صفحه</span>
      <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
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

function PaginationSummary({
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
    <div className="pagination-row">
      <span className="pagination-status">
        نمایش {start.toLocaleString('fa-IR')} تا {end.toLocaleString('fa-IR')} از{' '}
        {filteredTotal.toLocaleString('fa-IR')} ردیف
        {hasFiltered ? ` (کل: ${total.toLocaleString('fa-IR')})` : ''}
      </span>
      <div className="pagination-controls">
        <button
          aria-label="صفحه بعدی"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          {'<'}
        </button>
        {paginationItems.map((item, index) =>
          item === 'ellipsis' ? (
            <span className="pagination-ellipsis" key={`ellipsis-${index}`}>
              ...
            </span>
          ) : (
            <button
              aria-current={item === page ? 'page' : undefined}
              className={item === page ? 'active-page' : 'page-number'}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              {item.toLocaleString('fa-IR')}
            </button>
          ),
        )}
        <button
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
