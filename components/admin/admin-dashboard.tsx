'use client';

import {
  Add,
  ArchiveOutlined,
  BadgeOutlined,
  DashboardOutlined,
  Delete,
  Download,
  EditOutlined,
  LoginOutlined,
  Logout,
  QrCodeScanner,
  TableRowsOutlined,
  UploadFileOutlined,
} from '@mui/icons-material';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  ContentPanel,
  Modal,
  ModalActions,
  PageSizeControl,
  PaginationSummary,
  RecordField,
  StatCard,
  StatusPill,
  TextField,
  Toolbar,
} from '@/components/admin/dashboard-primitives';
import { PersianDateField } from '@/components/admin/persian-date-field';
import { persianDateKey } from '@/components/admin/persian-date';
import {
  createEmptySerialDraft,
  emptyLocationDraft,
  emptyProductDraft,
  seedLocations,
  seedModels,
  seedSerials,
} from '@/components/admin/sample-data';
import { SerialImportDialog } from '@/components/admin/serial-import-dialog';
import type {
  AuthUser,
  BootstrapData,
  ConfirmDialog,
  LocationDraft,
  LocationResponse,
  LocationSummary,
  LoginResponse,
  ProductDraft,
  ProductModel,
  ProductModelResponse,
  ScanContext,
  ScanMode,
  ScanResponse,
  SerialDraft,
  SerialRecord,
  SerialRecordListResponse,
  SerialRecordResponse,
  SessionResponse,
  ViewId,
} from '@/components/admin/types';
import {
  APP_VERSION,
  NATIVE_APK_DOWNLOAD_FILENAME,
  NATIVE_APK_DOWNLOAD_PATH,
} from '@/lib/app-info';
import { canManageData } from '@/lib/roles';
import { downloadExcelBlob, downloadSerialExcelFile } from '@/lib/serial-excel';

const menuItems: Array<{ id: ViewId; label: string; icon: ReactNode }> = [
  { id: 'serial-list', label: 'لیست سریال', icon: <BadgeOutlined /> },
  { id: 'product-list', label: 'لیست مدل کالا', icon: <TableRowsOutlined /> },
];

const scanModeOptions: Array<{ id: ScanMode; label: string }> = [
  { id: 'inbound', label: 'ورود' },
  { id: 'outbound', label: 'خروج' },
  { id: 'lookup', label: 'استعلام' },
];
const statusMessageTimeoutMs = 5000;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

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
  const [serialPageData, setSerialPageData] = useState<SerialRecordListResponse | null>(null);
  const [serialRefresh, setSerialRefresh] = useState(0);
  const [locations, setLocations] = useState<LocationSummary[]>(seedLocations);
  const [dataSource, setDataSource] = useState<'sample' | 'database'>('sample');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState<'success' | 'error'>('success');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [serialSearch, setSerialSearch] = useState('');
  const [serialQuery, setSerialQuery] = useState('');
  const [serialDateFrom, setSerialDateFrom] = useState('');
  const [serialDateTo, setSerialDateTo] = useState('');
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

  const [loginForm, setLoginForm] = useState({ username: 'admin', password: '' });
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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const applyBootstrapData = useCallback((data: BootstrapData) => {
    setModels(data.models.length > 0 ? data.models : seedModels);
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
    let isCancelled = false;

    async function loadSession() {
      try {
        const response = await fetch('/api/session', { cache: 'no-store' });
        const session = (await response.json()) as SessionResponse;

        if (isCancelled) {
          return;
        }

        if (session.authenticated) {
          setCurrentUser(session.user);
          setIsLoggedIn(true);
          window.localStorage.setItem('barcode-app-login', JSON.stringify(true));
        } else {
          setCurrentUser(null);
          setIsLoggedIn(false);
          window.localStorage.removeItem('barcode-app-login');
        }
      } catch {
        if (!isCancelled) {
          setCurrentUser(null);
          setIsLoggedIn(false);
        }
      } finally {
        if (!isCancelled) {
          setHasHydrated(true);
        }
      }
    }

    void loadSession();

    return () => {
      isCancelled = true;
    };
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
        setLocations(readStorage('barcode-app-locations', seedLocations));
        setDataSource('sample');
      }
    }

    void loadData();

    return () => controller.abort();
  }, [hasHydrated, loadBootstrapData]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setStatusMessage(''), statusMessageTimeoutMs);

    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

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

    window.localStorage.removeItem('barcode-app-serials');
  }, [hasHydrated]);

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

  useEffect(() => {
    const timeout = window.setTimeout(() => setSerialQuery(serialSearch.trim()), 300);

    return () => window.clearTimeout(timeout);
  }, [serialSearch]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const controller = new AbortController();

    async function loadSerials() {
      const params = new URLSearchParams({
        page: String(serialPage),
        pageSize: String(serialPageSize),
      });

      if (serialQuery) {
        params.set('search', serialQuery);
      }

      if (serialDateFrom) {
        params.set('dateFrom', serialDateFrom);
      }

      if (serialDateTo) {
        params.set('dateTo', serialDateTo);
      }

      const response = await fetch(`/api/serial-records?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Serial list request failed with ${response.status}`);
      }

      const data = (await response.json()) as SerialRecordListResponse;

      setSerialPageData(data);

      const totalPages = Math.max(1, Math.ceil(data.filteredTotal / data.pageSize));

      if (data.page > totalPages) {
        setSerialPage(totalPages);
      }
    }

    // A failed refresh keeps the last successful page: replacing real rows with
    // the sample fallback mid-session would misrepresent the filter result.
    loadSerials().catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setStatusTone('error');
      setStatusMessage('دریافت لیست سریال‌ها ناموفق بود.');
    });

    return () => controller.abort();
  }, [
    hasHydrated,
    serialDateFrom,
    serialDateTo,
    serialPage,
    serialPageSize,
    serialQuery,
    serialRefresh,
  ]);

  const refreshSerials = () => setSerialRefresh((current) => current + 1);

  const fallbackFilteredSerials = useMemo(() => {
    const query = serialSearch.trim().toLowerCase();
    const fromKey = persianDateKey(serialDateFrom);
    const toKey = persianDateKey(serialDateTo);

    return seedSerials.filter((item) => {
      const matchesQuery =
        !query ||
        [item.documentNo, item.customerName].some((value) => value.toLowerCase().includes(query));
      const itemDateKey = persianDateKey(item.date);
      const matchesDateFrom = !fromKey || (itemDateKey !== null && itemDateKey >= fromKey);
      const matchesDateTo = !toKey || (itemDateKey !== null && itemDateKey <= toKey);

      return matchesQuery && matchesDateFrom && matchesDateTo;
    });
  }, [serialDateFrom, serialDateTo, serialSearch]);

  const serialFilteredTotal = serialPageData?.filteredTotal ?? fallbackFilteredSerials.length;
  const serialTotal = serialPageData?.total ?? seedSerials.length;

  const modelTotalPages = Math.max(1, Math.ceil(filteredModels.length / modelPageSize));
  const serialTotalPages = Math.max(1, Math.ceil(serialFilteredTotal / serialPageSize));
  const safeModelPage = Math.min(modelPage, modelTotalPages);
  const safeSerialPage = Math.min(serialPage, serialTotalPages);
  const modelPageStart = (safeModelPage - 1) * modelPageSize;
  const serialPageStart = (safeSerialPage - 1) * serialPageSize;
  // Number rows from the page the server actually returned, so the counter stays
  // aligned with the visible rows while a new page is still in flight.
  const serialRowOffset = serialPageData
    ? (serialPageData.page - 1) * serialPageData.pageSize
    : serialPageStart;

  const paginatedModels = useMemo(
    () => filteredModels.slice(modelPageStart, modelPageStart + modelPageSize),
    [filteredModels, modelPageSize, modelPageStart],
  );

  const paginatedSerials = useMemo(
    () =>
      serialPageData
        ? serialPageData.serials
        : fallbackFilteredSerials.slice(serialPageStart, serialPageStart + serialPageSize),
    [fallbackFilteredSerials, serialPageData, serialPageSize, serialPageStart],
  );

  const stats = useMemo(() => {
    return {
      models: models.length,
      serials: serialTotal,
    };
  }, [models.length, serialTotal]);

  const openProductCreate = () => {
    setProductDialog({ mode: 'create', draft: emptyProductDraft });
  };

  const showStatusMessage = (message: string, tone: 'success' | 'error') => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const openSerialCreate = () => {
    setSerialDialog({ mode: 'create', draft: createEmptySerialDraft() });
  };

  const openLocationCreate = () => {
    setLocationDialog({ mode: 'create', draft: emptyLocationDraft });
  };

  const handleMenuClick = (id: ViewId) => {
    setActiveView(id);
  };

  const login = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    try {
      const data = await apiRequest<LoginResponse>('/api/login', {
        body: JSON.stringify(loginForm),
        method: 'POST',
      });

      window.localStorage.setItem('barcode-app-login', JSON.stringify(true));
      setCurrentUser(data.user);
      setIsLoggedIn(true);
      setStatusMessage('');
    } catch (error) {
      window.localStorage.removeItem('barcode-app-login');
      setCurrentUser(null);
      setIsLoggedIn(false);
      showStatusMessage(error instanceof Error ? error.message : 'ورود ناموفق بود.', 'error');
    }
  };

  const logout = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    await fetch('/api/logout', { method: 'POST' }).catch(() => undefined);
    window.localStorage.removeItem('barcode-app-login');
    setCurrentUser(null);
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
      showStatusMessage(data.message, data.action === 'NOT_FOUND' ? 'error' : 'success');

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
        setSerialPage(1);
        refreshSerials();
        setScanContext((current) => ({ ...current, trackingCode: '' }));
        void loadBootstrapData();
      }
    } catch (error) {
      showStatusMessage(error instanceof Error ? error.message : 'ثبت اسکن ناموفق بود.', 'error');
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
      showStatusMessage(
        productDialog.mode === 'create' ? 'مدل کالا ذخیره شد.' : 'مدل کالا ویرایش شد.',
        'success',
      );
    } catch (error) {
      showStatusMessage(
        error instanceof Error ? error.message : 'ذخیره مدل کالا ناموفق بود.',
        'error',
      );
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
        showStatusMessage('مدل کالا حذف شد.', 'success');
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
      if (serialDialog.mode === 'create') {
        await apiRequest<SerialRecordResponse>('/api/serial-records', {
          body: JSON.stringify(payload),
          method: 'POST',
        });
      } else {
        await apiRequest<SerialRecordResponse>(`/api/serial-records/${draft.id}`, {
          body: JSON.stringify(payload),
          method: 'PATCH',
        });
      }

      refreshSerials();
      setSerialDialog(null);
      showStatusMessage(
        serialDialog.mode === 'create' ? 'سریال ذخیره شد.' : 'سریال ویرایش شد.',
        'success',
      );
      void loadBootstrapData();
    } catch (error) {
      showStatusMessage(
        error instanceof Error ? error.message : 'ذخیره سریال ناموفق بود.',
        'error',
      );
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
        refreshSerials();
        showStatusMessage('سریال حذف شد.', 'success');
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
      showStatusMessage(
        locationDialog.mode === 'create' ? 'محل کالا ذخیره شد.' : 'محل کالا ویرایش شد.',
        'success',
      );
    } catch (error) {
      showStatusMessage(
        error instanceof Error ? error.message : 'ذخیره محل کالا ناموفق بود.',
        'error',
      );
    }
  };

  const confirmDelete = async () => {
    if (!confirmDialog) {
      return;
    }

    try {
      await confirmDialog.onConfirm();
    } catch (error) {
      showStatusMessage(
        error instanceof Error ? error.message : 'حذف اطلاعات ناموفق بود.',
        'error',
      );
    } finally {
      setConfirmDialog(null);
    }
  };

  const exportSerialsExcel = async () => {
    if (!serialPageData) {
      const serialSearchQuery = serialSearch.trim();
      const filteredDocumentNos = Array.from(
        new Set(fallbackFilteredSerials.map((item) => item.documentNo.trim()).filter(Boolean)),
      );
      const exportFilename =
        serialSearchQuery &&
        filteredDocumentNos.length === 1 &&
        filteredDocumentNos[0] === serialSearchQuery
          ? filteredDocumentNos[0]
          : `serials-${Date.now()}`;

      downloadSerialExcelFile(
        fallbackFilteredSerials.map((item) => ({
          date: item.date,
          documentNo: item.documentNo,
          customerName: item.customerName,
          productCode: item.productCode,
          model: item.model,
          trackingCode: item.trackingCode,
          serialNo: item.serialNo,
        })),
        exportFilename,
      );
      return;
    }

    try {
      const params = new URLSearchParams();

      if (serialQuery) {
        params.set('search', serialQuery);
      }

      if (serialDateFrom) {
        params.set('dateFrom', serialDateFrom);
      }

      if (serialDateTo) {
        params.set('dateTo', serialDateTo);
      }

      const response = await fetch(`/api/serial-records/export?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Export request failed with ${response.status}`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const filename = encodedFilename
        ? decodeURIComponent(encodedFilename)
        : `serials-${Date.now()}.xlsx`;

      downloadExcelBlob(blob, filename);
    } catch {
      showStatusMessage('دانلود فایل اکسل ناموفق بود.', 'error');
    }
  };

  const exportCsv = (type: 'models' | 'serials') => {
    if (type === 'serials') {
      void exportSerialsExcel();
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
      <main
        className="grid min-h-screen place-items-center bg-linear-to-br from-dcode-900 via-app-ink to-app-bg p-4 font-sans text-app-ink"
        dir="rtl"
      >
        <section
          className="grid w-[min(960px,100%)] grid-cols-2 items-center overflow-hidden rounded-3xl border border-white/35 bg-app-surface/75 shadow-2xl backdrop-blur-lg max-smd:grid-cols-1"
          aria-label="ورود به برنامه انبار"
        >
          <div
            className="relative grid min-h-96 place-items-center overflow-hidden bg-dcode-900 max-smd:min-h-56"
            aria-hidden="true"
          >
            <Image
              className="relative z-1 h-auto w-[min(340px,76%)] max-smd:w-[min(250px,70%)]"
              src="/favicon/source/dcode-wordmark-light.png"
              alt=""
              width={736}
              height={185}
              priority
            />
          </div>

          <form
            className={
              'relative grid gap-4 bg-linear-to-b from-app-surface/90 to-app-surface/65 px-16 py-16 before:text-3xl before:font-black before:text-dcode-900 before:content-["ورود_به_سامانه"] after:-mt-2.5 after:mb-2 after:text-sm after:font-bold after:text-app-muted after:content-["مدیریت_سریع_ورود_و_خروج_کالا_با_اسکن_بارکد"] max-smd:px-6 max-smd:py-8'
            }
            onSubmit={login}
          >
            <label className="relative grid gap-2 text-sm font-bold text-app-muted">
              <span>نام کاربری</span>
              <LoginOutlined className="absolute right-4 bottom-3.5 size-5! text-dcode-red-500" />
              <input
                className="h-14 w-full rounded-full border-0 bg-app-surface-soft px-3 pr-12 text-app-ink outline-none transition focus:border-dcode-red-500 focus:ring-4 focus:ring-dcode-red-500/10"
                name="username"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, username: event.target.value }))
                }
                autoComplete="username"
              />
            </label>
            <label className={'relative grid gap-2 text-sm font-bold text-app-muted'}>
              <span>رمز عبور</span>
              <BadgeOutlined className={'absolute right-4 bottom-3.5 size-5! text-dcode-red-500'} />
              <input
                className={
                  'h-14 w-full rounded-full border-0 bg-app-surface-soft px-3 pr-12 text-app-ink outline-none transition focus:border-dcode-red-500 focus:ring-4 ring-dcode-red-500/10'
                }
                name="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
                type="password"
                autoComplete="current-password"
              />
            </label>
            {statusMessage && (
              <p className="-mt-1 mb-3.5 rounded-xl border border-dcode-red-500/20 bg-dcode-red-100 px-4 py-3 font-extrabold text-dcode-red-700">
                {statusMessage}
              </p>
            )}
            <button
              className={cx(
                'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 bg-linear-to-br from-dcode-red-500 to-dcode-red-700 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70',
                'mt-1 h-14 rounded-full',
              )}
              type="submit"
            >
              ورود
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main
      className={
        'grid min-h-screen grid-cols-[260px_minmax(0,1fr)] gap-4 p-4 font-sans text-app-ink max-lg:grid-cols-1 max-lg:p-2.5 max-smd:gap-2.5 max-smd:p-2 max-xs:p-1.5'
      }
      dir="rtl"
    >
      <aside
        className={
          'sticky top-4 flex h-[calc(100vh-32px)] flex-col gap-6 rounded-2xl border border-white/10 bg-linear-to-b from-dcode-800 to-dcode-950 px-4 py-6 text-white shadow-dcode-panel max-lg:static max-lg:h-auto max-smd:gap-3.5 max-smd:rounded-2xl max-smd:p-4 max-smd:px-3.5'
        }
        aria-label="منوی اصلی"
      >
        <div
          className={
            'flex items-center justify-between gap-3 border-b border-white/15 pb-5 max-smd:pb-3.5'
          }
        >
          <div>
            <strong className={'block text-base font-bold'}>D&apos;CODE</strong>
            <span className={'mt-1.5 block text-xs text-white/60'}>سامانه انبار و سریال</span>
          </div>
          <Image
            className={'h-auto w-28'}
            src="/favicon/source/dcode-wordmark-light.png"
            alt="D'CODE"
            width={147}
            height={37}
          />
        </div>

        <nav className={'grid gap-2 max-lg:grid-cols-2 max-smd:grid-cols-1'}>
          {menuItems.map((item) => (
            <button
              className={cx(
                'flex h-14 items-center gap-2.5 rounded-xl border-0 bg-transparent px-3.5 text-right text-white/85 transition hover:-translate-x-0.5 hover:bg-dcode-red-500/15 hover:text-white max-smd:h-12 max-smd:rounded-lg max-smd:hover:translate-x-0',
                activeView === item.id &&
                  'bg-dcode-red-500/15 text-white shadow-[inset_3px_0_0_var(--color-dcode-red-500)]',
              )}
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <section
          className={
            'mt-auto grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-right shadow-[inset_0_1px_0_rgb(255_255_255/8%)] md:w-1/2 lg:w-full'
          }
          aria-label="نسخه برنامه"
        >
          <div className={'flex items-center justify-between gap-3 text-sm font-extrabold'}>
            <span className={'text-white/60'}>نسخه برنامه</span>
            <span className={'font-black text-white'} dir="ltr">
              v{APP_VERSION}
            </span>
          </div>
          <div className={'grid gap-2'}>
            <a
              className={cx(
                'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl',
                'bg-app-surface/15',
              )}
              download={NATIVE_APK_DOWNLOAD_FILENAME}
              href={NATIVE_APK_DOWNLOAD_PATH}
            >
              <Download />
              APK native
            </a>
          </div>
        </section>
      </aside>

      <section className={'flex min-w-0 flex-col gap-4'}>
        <header
          className={
            'flex min-h-14 items-center justify-between gap-3.5 rounded-2xl border border-white/25 bg-linear-to-br from-dcode-900 to-app-ink px-4 text-white shadow-dcode-soft max-smd:min-h-0 md:flex max-smd:items-stretch max-smd:p-3.5'
          }
        >
          <div className={'flex items-center gap-2 font-bold max-smd:flex-wrap'}>
            <DashboardOutlined />
            <span>کاربر جاری : {currentUser?.username ?? '-'}</span>
          </div>
          <form onSubmit={logout}>
            <button
              className={cx(
                'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                'bg-app-surface/15 shadow-none',
              )}
              type="submit"
            >
              <Logout />
              خروج
            </button>
          </form>
        </header>

        <section
          className={'grid grid-cols-2 gap-3 max-lg:grid-cols-2 max-smd:gap-2.5'}
          aria-label="خلاصه وضعیت انبار"
        >
          <StatCard label="کل سریال" value={stats.serials} tone="green" />
          <StatCard label="مدل کالا" value={stats.models} tone="blue" />
        </section>

        {statusMessage && (
          <p
            className={cx(
              '-mt-1 mb-3.5 rounded-xl border px-4 py-3 font-extrabold',
              statusTone === 'success'
                ? 'border-emerald-500/25 bg-emerald-50 text-emerald-700'
                : 'border-dcode-red-500/20 bg-dcode-red-100 text-dcode-red-700',
            )}
          >
            {statusMessage}
          </p>
        )}

        {activeView === 'serial-new' && (
          <ContentPanel
            title="اسکن بارکد"
            subtitle="ثبت سریع ورود، خروج و استعلام"
            action={
              <button
                className={cx(
                  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                  'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
                )}
                onClick={() => setActiveView('serial-list')}
              >
                مشاهده لیست
              </button>
            }
          >
            <section className={'grid w-[min(760px,100%)] gap-4 max-smd:w-full'}>
              <div
                className={
                  'grid grid-cols-3 gap-2.5 rounded-2xl border border-app-line bg-app-surface-soft p-1.5 max-smd:rounded-xl'
                }
                aria-label="نوع عملیات اسکن"
              >
                {scanModeOptions.map((option) => (
                  <button
                    className={cx(
                      'min-h-11 rounded-xl border-0 bg-transparent font-black text-app-muted',
                      scanMode === option.id &&
                        'bg-linear-to-br from-dcode-red-500 to-dcode-red-700 text-white shadow-lg',
                    )}
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
                <article
                  className={
                    'grid gap-3 rounded-2xl border border-dcode-900/12 bg-app-surface-soft p-4 max-smd:p-3.5'
                  }
                >
                  <div className={'grid gap-1.5'}>
                    <span className={'text-xs font-extrabold text-app-muted'}>
                      آماده برای ثبت سریال
                    </span>
                    <strong className={'wrap-anywhere text-lg font-bold text-dcode-900'}>
                      {scanContext.model?.model ?? 'مدل انتخاب نشده'}
                    </strong>
                  </div>
                  <div className={'grid gap-0.5 border-t border-app-line pt-1'}>
                    <RecordField label="شناسه کالا" value={scanContext.model?.productCode || '-'} />
                    <RecordField label="کد رهگیری" value={scanContext.trackingCode || '-'} />
                  </div>
                  <button
                    className={cx(
                      'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                      'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
                    )}
                    onClick={() => setScanContext({ model: null, trackingCode: '' })}
                    type="button"
                  >
                    پاک کردن
                  </button>
                </article>
              )}

              <form
                className={
                  'grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-2xl border border-dcode-900/12 bg-linear-to-b from-app-surface to-app-surface-soft p-4 shadow-dcode-soft max-smd:grid-cols-1 max-smd:rounded-xl max-smd:p-3.5'
                }
                onSubmit={submitScan}
              >
                <label className={'relative grid gap-2 text-sm font-extrabold text-app-muted'}>
                  <span>بارکد</span>
                  <QrCodeScanner
                    className={'absolute right-3.5 bottom-3.5 size-5! text-dcode-red-500'}
                  />
                  <input
                    className={
                      'h-14 w-full rounded-xl border border-dcode-900/12 bg-app-surface px-3.5 pr-12 text-lg font-black text-dcode-900 uppercase outline-none focus:border-dcode-red-500 focus:ring-4 focus:ring-dcode-red-500/10 max-smd:h-14 max-smd:text-base'
                    }
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
                <button
                  className={cx(
                    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                    'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
                  )}
                  disabled={isScanBusy}
                  type="submit"
                >
                  <QrCodeScanner />
                  {isScanBusy ? 'در حال ثبت' : 'ثبت اسکن'}
                </button>
              </form>

              {scanResult && (
                <article
                  className={cx(
                    'grid gap-3 rounded-2xl border border-dcode-900/12 bg-app-surface-soft p-4 max-smd:p-3.5',
                    scanResult.action === 'NOT_FOUND' &&
                      'border-dcode-gold-600/35 bg-dcode-gold-600/10',
                  )}
                >
                  <div className={'grid gap-1.5'}>
                    <span className={'text-xs font-extrabold text-app-muted'}>آخرین اسکن</span>
                    <strong className={'wrap-anywhere text-lg font-bold text-dcode-900'}>
                      {scanResult.barcode}
                    </strong>
                  </div>
                  <p
                    className={cx(
                      'm-0 font-black text-dcode-red-700',
                      scanResult.action === 'NOT_FOUND' && 'text-dcode-gold-700',
                    )}
                  >
                    {scanResult.message}
                  </p>
                  {scanResult.serial && (
                    <div className={'grid gap-0.5 border-t border-app-line pt-1'}>
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
                    <div className={'grid gap-0.5 border-t border-app-line pt-1'}>
                      <RecordField label="مدل کالا" value={scanResult.matchedModel.model} />
                      <RecordField label="شناسه کالا" value={scanResult.matchedModel.productCode} />
                    </div>
                  )}
                </article>
              )}

              <div className={'flex flex-wrap gap-2.5'}>
                <button
                  className={cx(
                    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                    'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
                  )}
                  onClick={openSerialCreate}
                  type="button"
                >
                  <Add />
                  ثبت دستی
                </button>
                <button
                  className={
                    'inline-flex min-h-10 items-center justify-center rounded-xl border border-app-line bg-app-surface px-4 font-black text-dcode-900'
                  }
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
              <div className="flex items-center gap-2 max-xs:flex-col max-xs:items-stretch">
                {canManageData(currentUser?.role) && (
                  <button
                    className={
                      'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 font-extrabold text-dcode-900 shadow-sm transition hover:-translate-y-px hover:shadow-md max-xs:px-3'
                    }
                    onClick={() => setIsImportDialogOpen(true)}
                    type="button"
                  >
                    <UploadFileOutlined />
                    بازیابی از اکسل
                  </button>
                )}
                <button
                  className={cx(
                    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                    'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
                  )}
                  onClick={openSerialCreate}
                  type="button"
                >
                  <Add />
                  سریال جدید
                </button>
              </div>
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
            <div
              className={
                'my-4 mb-5 grid w-full items-end gap-x-4 gap-y-6 rounded-2xl border border-app-line/80 bg-linear-to-b from-app-surface to-app-surface-soft px-4 py-3.5 shadow-dcode-soft md:grid-cols-[0.8fr_1.7fr_1.7fr_1.2fr]'
              }
            >
              <span
                className={
                  'col-start-1 ml-3 self-center whitespace-nowrap text-base font-black text-dcode-900 before:ml-2 before:inline-block before:size-2 before:rounded-full before:bg-dcode-red-500 before:ring-4 before:ring-dcode-red-500/10'
                }
              >
                بازه تاریخ
              </span>
              <PersianDateField
                label="از"
                onChange={(value) => {
                  setSerialDateFrom(value);
                  setSerialPage(1);
                }}
                placeholder="انتخاب تاریخ"
                value={serialDateFrom}
              />
              <PersianDateField
                label="تا"
                onChange={(value) => {
                  setSerialDateTo(value);
                  setSerialPage(1);
                }}
                placeholder="انتخاب تاریخ"
                value={serialDateTo}
              />
              <button
                className={cx(
                  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-bold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                  'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
                  'min-h-11 whitespace-nowrap rounded-lg px-3.5 shadow-none md:max-w-80',
                )}
                onClick={() => {
                  setSerialDateFrom('');
                  setSerialDateTo('');
                  setSerialPage(1);
                }}
                type="button"
              >
                پاکسازی تاریخ
              </button>
            </div>
            <div className={'mb-3.5 -mt-1 flex justify-start max-smd:justify-end'}>
              <PageSizeControl
                onPageSizeChange={(value) => {
                  setSerialPageSize(value);
                  setSerialPage(1);
                }}
                pageSize={serialPageSize}
              />
            </div>
            <div
              className={
                'max-h-[min(62vh,680px)] overflow-auto rounded-xl border border-app-line bg-app-surface shadow-[inset_0_1px_0_rgb(255_255_255/85%)] [scrollbar-gutter:stable_both-edges] max-smd:hidden'
              }
            >
              <table
                className={cx(
                  'w-full min-w-245 border-separate border-spacing-0 text-app-muted [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-l [&_td]:border-app-line/60 [&_td]:px-3.5 [&_td]:py-3 [&_td]:text-right [&_th]:sticky [&_th]:top-0 [&_th]:z-1 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-l [&_th]:border-app-line/60 [&_th]:bg-app-line [&_th]:px-3.5 [&_th]:py-3 [&_th]:text-right [&_th]:text-sm [&_th]:font-black [&_th]:text-slate-700 [&_tbody_tr:nth-child(odd)]:bg-app-surface [&_tbody_tr:nth-child(even)]:bg-app-surface-soft [&_tbody_tr:hover]:bg-dcode-red-100',
                  'min-w-430 [&_td:nth-child(8)]:min-w-62.5 [&_th:nth-child(8)]:min-w-62.5',
                )}
              >
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
                      <td>{serialRowOffset + index + 1}</td>
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
                        <div className={'flex gap-2 max-smd:w-full max-smd:flex-wrap'}>
                          <button
                            className={cx(
                              'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border-0 px-3 text-xs font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08]',
                              'bg-linear-to-br from-dcode-gold-600 to-dcode-gold-700',
                            )}
                            onClick={() => updateSerial(item)}
                            type="button"
                          >
                            <EditOutlined />
                            ویرایش
                          </button>
                          <button
                            className={cx(
                              'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border-0 px-3 text-xs font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08]',
                              'bg-linear-to-br from-app-ink to-dcode-900',
                            )}
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
            <div className={'hidden gap-3 max-smd:grid'} aria-label="لیست سریال‌ها">
              {paginatedSerials.length > 0 ? (
                paginatedSerials.map((item, index) => (
                  <article
                    className={
                      'grid gap-3.5 rounded-2xl border border-app-line bg-linear-to-b from-app-surface to-app-surface-soft p-3.5 shadow-dcode-soft'
                    }
                    key={item.id}
                  >
                    <div
                      className={
                        'flex items-center justify-between gap-3 border-b border-app-line pb-2.5'
                      }
                    >
                      <strong
                        className={'min-w-0 wrap-anywhere text-base font-bold text-dcode-900'}
                      >
                        {item.serialNo}
                      </strong>
                      <span className={'shrink-0 font-black text-dcode-red-700'}>
                        #{(serialRowOffset + index + 1).toLocaleString('fa-IR')}
                      </span>
                    </div>
                    <div className={'grid gap-0.5'}>
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
                    <div
                      className={'flex items-start justify-between gap-3 pt-0.5 max-smd:flex-col'}
                    >
                      <StatusPill tone={item.status === 'ثبت شده' ? 'green' : 'orange'}>
                        {item.status}
                      </StatusPill>
                      <div className={'flex gap-2 max-smd:w-full max-smd:flex-wrap'}>
                        <button
                          className={cx(
                            'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border-0 px-3 text-xs font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08]',
                            'bg-linear-to-br from-dcode-gold-600 to-dcode-gold-700',
                          )}
                          onClick={() => updateSerial(item)}
                          type="button"
                        >
                          <EditOutlined />
                          ویرایش
                        </button>
                        <button
                          className={cx(
                            'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border-0 px-3 text-xs font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08]',
                            'bg-linear-to-br from-app-ink to-dcode-900',
                          )}
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
                <p
                  className={
                    'm-0 rounded-xl border border-dashed border-dcode-red-500/30 bg-app-surface-soft p-4 text-center font-extrabold text-app-muted'
                  }
                >
                  رکوردی برای نمایش وجود ندارد.
                </p>
              )}
            </div>
            <PaginationSummary
              filteredTotal={serialFilteredTotal}
              onPageChange={setSerialPage}
              page={safeSerialPage}
              pageSize={serialPageSize}
              total={serialTotal}
            />
          </ContentPanel>
        )}

        {activeView === 'product-list' && (
          <ContentPanel
            title="لیست مدل کالا"
            subtitle="مدیریت مدل‌ها و شناسه‌های کالا"
            action={
              <button
                className={cx(
                  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                  'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
                )}
                onClick={openProductCreate}
                type="button"
              >
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
            <div className={'mb-3.5 -mt-1 flex justify-start max-smd:justify-end'}>
              <PageSizeControl
                onPageSizeChange={(value) => {
                  setModelPageSize(value);
                  setModelPage(1);
                }}
                pageSize={modelPageSize}
              />
            </div>
            <div
              className={
                'max-h-[min(62vh,680px)] overflow-auto rounded-xl border border-app-line bg-app-surface shadow-[inset_0_1px_0_rgb(255_255_255/85%)] [scrollbar-gutter:stable_both-edges] max-smd:hidden'
              }
            >
              <table
                className={
                  'w-full min-w-245 border-separate border-spacing-0 text-app-muted [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-l [&_td]:border-app-line/60 [&_td]:px-3.5 [&_td]:py-3 [&_td]:text-right [&_th]:sticky [&_th]:top-0 [&_th]:z-1 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-l [&_th]:border-app-line/60 [&_th]:bg-app-line [&_th]:px-3.5 [&_th]:py-3 [&_th]:text-right [&_th]:text-sm [&_th]:font-black [&_th]:text-slate-700 [&_tbody_tr:nth-child(odd)]:bg-app-surface [&_tbody_tr:nth-child(even)]:bg-app-surface-soft [&_tbody_tr:hover]:bg-dcode-red-100'
                }
              >
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
                        <StatusPill tone={item.status === 'ثبت شده' ? 'green' : 'orange'}>
                          {item.status}
                        </StatusPill>
                      </td>
                      <td>
                        <div className={'flex gap-2 max-smd:w-full max-smd:flex-wrap'}>
                          <button
                            className={cx(
                              'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border-0 px-3 text-xs font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08]',
                              'bg-linear-to-br from-dcode-gold-600 to-dcode-gold-700',
                            )}
                            onClick={() => updateModel(item)}
                            type="button"
                          >
                            <EditOutlined />
                            ویرایش
                          </button>
                          <button
                            className={cx(
                              'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border-0 px-3 text-xs font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08]',
                              'bg-linear-to-br from-app-ink to-dcode-900',
                            )}
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
            <div className={'hidden gap-3 max-smd:grid'} aria-label="لیست مدل کالا">
              {paginatedModels.length > 0 ? (
                paginatedModels.map((item, index) => (
                  <article
                    className={
                      'grid gap-3.5 rounded-2xl border border-app-line bg-linear-to-b from-app-surface to-app-surface-soft p-3.5 shadow-dcode-soft'
                    }
                    key={item.id}
                  >
                    <div
                      className={
                        'flex items-center justify-between gap-3 border-b border-app-line pb-2.5'
                      }
                    >
                      <strong
                        className={'min-w-0 wrap-anywhere text-base font-bold text-dcode-900'}
                      >
                        {item.model}
                      </strong>
                      <span className={'shrink-0 font-black text-dcode-red-700'}>
                        #{(modelPageStart + index + 1).toLocaleString('fa-IR')}
                      </span>
                    </div>
                    <div className={'grid gap-0.5'}>
                      <RecordField label="شناسه کالا" value={item.productCode} />
                      <RecordField label="شناسه گارانتی" value={item.warrantyCode || '-'} />
                      <RecordField label="تاریخ ایجاد" value={item.createdAt} />
                      <RecordField label="تاریخ ویرایش" value={item.updatedAt} />
                    </div>
                    <div
                      className={'flex items-start justify-between gap-3 pt-0.5 max-smd:flex-col'}
                    >
                      <StatusPill tone={item.status === 'ثبت شده' ? 'green' : 'orange'}>
                        {item.status}
                      </StatusPill>
                      <div className={'flex gap-2 max-smd:w-full max-smd:flex-wrap'}>
                        <button
                          className={cx(
                            'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border-0 px-3 text-xs font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08]',
                            'bg-linear-to-br from-dcode-gold-600 to-dcode-gold-700',
                          )}
                          onClick={() => updateModel(item)}
                          type="button"
                        >
                          <EditOutlined />
                          ویرایش
                        </button>
                        <button
                          className={cx(
                            'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border-0 px-3 text-xs font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08]',
                            'bg-linear-to-br from-app-ink to-dcode-900',
                          )}
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
                <p
                  className={
                    'm-0 rounded-xl border border-dashed border-dcode-red-500/30 bg-app-surface-soft p-4 text-center font-extrabold text-app-muted'
                  }
                >
                  رکوردی برای نمایش وجود ندارد.
                </p>
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
              <button
                className={cx(
                  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                  'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
                )}
                onClick={openLocationCreate}
                type="button"
              >
                <Add />
                محل جدید
              </button>
            }
          >
            <div className={'grid grid-cols-4 gap-3.5 max-lg:grid-cols-2 max-smd:grid-cols-1'}>
              {locations.map((location) => (
                <article
                  className={
                    'flex min-h-28 items-center justify-between gap-3.5 rounded-2xl border border-app-line bg-linear-to-b from-app-surface to-app-surface-soft p-4 shadow-dcode-soft max-smd:grid max-smd:min-h-24 max-smd:grid-cols-[auto_minmax(0,1fr)] max-smd:justify-stretch max-smd:p-4'
                  }
                  key={location.id}
                >
                  <ArchiveOutlined className={'size-9! text-dcode-red-500 max-smd:size-8!'} />
                  <div className={'min-w-0 flex-1'}>
                    <strong
                      className={
                        'block text-base font-bold max-smd:text-base max-smd:wrap-anywhere'
                      }
                    >
                      {location.name}
                    </strong>
                    <span className={'mt-1.5 block text-sm text-app-muted'}>
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
          <form
            className={
              'grid grid-cols-1 gap-4 p-6 max-smd:gap-3.5 max-smd:px-4 max-smd:py-4 max-xs:px-3.5'
            }
            onSubmit={saveProduct}
          >
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
            className={cx(
              'grid grid-cols-1 gap-4 p-6 max-smd:gap-3.5 max-smd:px-4 max-smd:py-4 max-xs:px-3.5',
              'grid-cols-2 max-smd:grid-cols-1',
            )}
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
          <form
            className={
              'grid grid-cols-1 gap-4 p-6 max-smd:gap-3.5 max-smd:px-4 max-smd:py-4 max-xs:px-3.5'
            }
            onSubmit={saveLocation}
          >
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
          <div
            className={
              'flex items-center justify-start gap-2.5 p-6 max-smd:flex-col-reverse max-smd:items-stretch'
            }
          >
            <button
              className={cx(
                'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                'bg-linear-to-br from-dcode-red-500 to-dcode-red-700',
              )}
              onClick={() => setConfirmDialog(null)}
              type="button"
            >
              انصراف
            </button>
            <button
              className={cx(
                'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border-0 px-4 font-extrabold text-white shadow-lg transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-xl disabled:cursor-wait disabled:opacity-70 max-xs:px-3',
                'bg-linear-to-br from-app-ink to-dcode-900',
              )}
              onClick={confirmDelete}
              type="button"
            >
              <Delete />
              {confirmDialog.confirmLabel}
            </button>
          </div>
        </Modal>
      )}

      {isImportDialogOpen && (
        <SerialImportDialog
          onClose={() => setIsImportDialogOpen(false)}
          onImported={(message) => {
            setIsImportDialogOpen(false);
            refreshSerials();
            showStatusMessage(message, 'success');
          }}
        />
      )}
    </main>
  );
}
