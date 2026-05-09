'use client';

import {
  Add,
  ArchiveOutlined,
  BadgeOutlined,
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
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';

type ViewId = 'serial-new' | 'serial-list' | 'product-new' | 'product-list' | 'locations';
type MovementType = 'ورود' | 'خروج';
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
  status: SerialStatus;
};

const today = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

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
    status: 'خروج شده',
  },
];

const menuItems: Array<{ id: ViewId; label: string; icon: ReactNode }> = [
  { id: 'locations', label: 'لیست محل کالا', icon: <ArchiveOutlined /> },
  { id: 'product-new', label: 'تعریف کالا', icon: <Inventory2Outlined /> },
  { id: 'product-list', label: 'لیست مدل', icon: <TableRowsOutlined /> },
  { id: 'serial-list', label: 'لیست سریال', icon: <BadgeOutlined /> },
  { id: 'serial-new', label: 'سریال جدید', icon: <QrCodeScanner /> },
];

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

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

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => readStorage('barcode-app-login', false));
  const [activeView, setActiveView] = useState<ViewId>('serial-new');
  const [models, setModels] = useState<ProductModel[]>(() =>
    readStorage('barcode-app-models', seedModels),
  );
  const [serials, setSerials] = useState<SerialRecord[]>(() =>
    readStorage('barcode-app-serials', seedSerials),
  );
  const [modelSearch, setModelSearch] = useState('');
  const [serialSearch, setSerialSearch] = useState('');
  const serialInputRef = useRef<HTMLInputElement>(null);

  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin' });
  const [modelForm, setModelForm] = useState({
    model: '',
    productCode: '',
    warrantyCode: '',
  });
  const [serialForm, setSerialForm] = useState({
    date: today,
    documentNo: '',
    customerName: '',
    productCode: '',
    model: '',
    trackingCode: '',
    serialNo: '',
    movement: 'ورود' as MovementType,
  });

  useEffect(() => {
    window.localStorage.setItem('barcode-app-models', JSON.stringify(models));
  }, [models]);

  useEffect(() => {
    window.localStorage.setItem('barcode-app-serials', JSON.stringify(serials));
  }, [serials]);

  useEffect(() => {
    window.localStorage.setItem('barcode-app-login', JSON.stringify(isLoggedIn));
  }, [isLoggedIn]);

  useEffect(() => {
    if (activeView === 'serial-new') {
      serialInputRef.current?.focus();
    }
  }, [activeView]);

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
      [
        item.date,
        item.documentNo,
        item.customerName,
        item.productCode,
        item.model,
        item.trackingCode,
        item.serialNo,
        item.movement,
        item.status,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [serialSearch, serials]);

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

  const addModel = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modelForm.model.trim() || !modelForm.productCode.trim()) {
      return;
    }

    setModels((current) => [
      {
        id: makeId(),
        model: modelForm.model.trim(),
        productCode: modelForm.productCode.trim(),
        warrantyCode: modelForm.warrantyCode.trim() || '0',
        createdAt: today,
        updatedAt: today,
        status: 'فعال',
      },
      ...current,
    ]);
    setModelForm({ model: '', productCode: '', warrantyCode: '' });
    setActiveView('product-list');
  };

  const addSerial = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!serialForm.serialNo.trim()) {
      return;
    }

    const matchedModel = models.find(
      (item) =>
        item.productCode === serialForm.productCode.trim() ||
        serialForm.serialNo.includes(item.productCode) ||
        item.model === serialForm.model.trim(),
    );

    setSerials((current) => [
      {
        id: makeId(),
        date: serialForm.date,
        documentNo: serialForm.documentNo.trim(),
        customerName: serialForm.customerName.trim() || 'انبار مرکزی',
        productCode: serialForm.productCode.trim() || matchedModel?.productCode || '',
        model: serialForm.model.trim() || matchedModel?.model || '',
        trackingCode: serialForm.trackingCode.trim(),
        serialNo: serialForm.serialNo.trim(),
        movement: serialForm.movement,
        createdAt: today,
        status: serialForm.movement === 'ورود' ? 'ثبت شده' : 'خروج شده',
      },
      ...current,
    ]);
    setSerialForm((current) => ({
      ...current,
      trackingCode: '',
      serialNo: '',
    }));
    serialInputRef.current?.focus();
  };

  const exportCsv = (type: 'models' | 'serials') => {
    const rows =
      type === 'models'
        ? filteredModels.map((item, index) => ({
            '#': index + 1,
            model: item.model,
            productCode: item.productCode,
            warrantyCode: item.warrantyCode,
            createdAt: item.createdAt,
            status: item.status,
          }))
        : filteredSerials.map((item, index) => ({
            '#': index + 1,
            serialNo: item.serialNo,
            model: item.model,
            productCode: item.productCode,
            movement: item.movement,
            documentNo: item.documentNo,
            date: item.date,
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
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault();
              setIsLoggedIn(true);
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
            <button className="primary-button login-button" type="submit">
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
              onClick={() => setActiveView(item.id)}
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
          <button className="ghost-button" onClick={() => setIsLoggedIn(false)} type="button">
            <Logout />
            خروج
          </button>
        </header>

        <section className="stats-grid" aria-label="خلاصه وضعیت انبار">
          <StatCard label="مدل کالا" value={stats.models} tone="blue" />
          <StatCard label="کل سریال" value={stats.serials} tone="green" />
          <StatCard label="ورودی" value={stats.inbound} tone="emerald" />
          <StatCard label="خروجی" value={stats.outbound} tone="rose" />
        </section>

        {activeView === 'serial-new' && (
          <ContentPanel
            title="ایجاد سریال"
            subtitle="اسکن یا ورود دستی اطلاعات محصول"
            action={
              <button className="secondary-button" onClick={() => setActiveView('serial-list')}>
                مشاهده لیست
              </button>
            }
          >
            <form className="form-grid" onSubmit={addSerial}>
              <TextField
                label="تاریخ"
                value={serialForm.date}
                onChange={(value) => setSerialForm((current) => ({ ...current, date: value }))}
              />
              <TextField
                label="شماره سند"
                value={serialForm.documentNo}
                onChange={(value) =>
                  setSerialForm((current) => ({ ...current, documentNo: value }))
                }
              />
              <TextField
                label="نام مشتری"
                value={serialForm.customerName}
                onChange={(value) =>
                  setSerialForm((current) => ({ ...current, customerName: value }))
                }
              />
              <TextField
                label="شناسه کالا"
                value={serialForm.productCode}
                onChange={(value) =>
                  setSerialForm((current) => ({ ...current, productCode: value }))
                }
              />
              <TextField
                label="مدل کالا"
                value={serialForm.model}
                onChange={(value) => setSerialForm((current) => ({ ...current, model: value }))}
              />
              <TextField
                label="کد رهگیری"
                value={serialForm.trackingCode}
                onChange={(value) =>
                  setSerialForm((current) => ({ ...current, trackingCode: value }))
                }
              />
              <TextField
                inputRef={serialInputRef}
                label="شماره سریال"
                value={serialForm.serialNo}
                onChange={(value) => setSerialForm((current) => ({ ...current, serialNo: value }))}
                placeholder="اسکن بارکد..."
                wide
              />
              <label className="field">
                <span>نوع عملیات</span>
                <select
                  value={serialForm.movement}
                  onChange={(event) =>
                    setSerialForm((current) => ({
                      ...current,
                      movement: event.target.value as MovementType,
                    }))
                  }
                >
                  <option>ورود</option>
                  <option>خروج</option>
                </select>
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  <Add />
                  ایجاد
                </button>
                <button
                  className="danger-button"
                  onClick={() =>
                    setSerialForm({
                      date: today,
                      documentNo: '',
                      customerName: '',
                      productCode: '',
                      model: '',
                      trackingCode: '',
                      serialNo: '',
                      movement: 'ورود',
                    })
                  }
                  type="button"
                >
                  انصراف
                </button>
              </div>
            </form>
          </ContentPanel>
        )}

        {activeView === 'serial-list' && (
          <ContentPanel
            title="لیست سریال‌ها"
            subtitle="ردیابی ورود و خروج کالا"
            action={
              <button className="accent-button" onClick={() => setActiveView('serial-new')}>
                <Add />
                سریال جدید
              </button>
            }
          >
            <Toolbar
              onExport={() => exportCsv('serials')}
              onSearch={setSerialSearch}
              search={serialSearch}
            />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>شماره سریال</th>
                    <th>مدل کالا</th>
                    <th>شناسه کالا</th>
                    <th>نوع</th>
                    <th>شماره سند</th>
                    <th>نام مشتری</th>
                    <th>تاریخ</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSerials.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>{item.serialNo}</td>
                      <td>{item.model || '-'}</td>
                      <td>{item.productCode || '-'}</td>
                      <td>{item.movement}</td>
                      <td>{item.documentNo || '-'}</td>
                      <td>{item.customerName}</td>
                      <td>{item.date}</td>
                      <td>
                        <StatusPill tone={item.status === 'ثبت شده' ? 'green' : 'orange'}>
                          {item.status}
                        </StatusPill>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="mini-button orange" type="button">
                            <EditOutlined />
                            ویرایش
                          </button>
                          <button
                            className="mini-button red"
                            onClick={() =>
                              setSerials((current) =>
                                current.filter((serial) => serial.id !== item.id),
                              )
                            }
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
            <PaginationSummary count={filteredSerials.length} total={serials.length} />
          </ContentPanel>
        )}

        {activeView === 'product-new' && (
          <ContentPanel
            title="تعریف کالای جدید"
            subtitle="ثبت مدل و شناسه کالا"
            action={
              <button className="secondary-button" onClick={() => setActiveView('product-list')}>
                مشاهده لیست
              </button>
            }
          >
            <form className="form-grid compact-form" onSubmit={addModel}>
              <TextField
                label="مدل"
                value={modelForm.model}
                onChange={(value) => setModelForm((current) => ({ ...current, model: value }))}
              />
              <TextField
                label="شناسه کالا"
                value={modelForm.productCode}
                onChange={(value) =>
                  setModelForm((current) => ({ ...current, productCode: value }))
                }
              />
              <TextField
                label="شناسه گارانتی"
                value={modelForm.warrantyCode}
                onChange={(value) =>
                  setModelForm((current) => ({ ...current, warrantyCode: value }))
                }
              />
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  <Add />
                  ایجاد
                </button>
                <button
                  className="danger-button"
                  onClick={() => setModelForm({ model: '', productCode: '', warrantyCode: '' })}
                  type="button"
                >
                  انصراف
                </button>
              </div>
            </form>
          </ContentPanel>
        )}

        {activeView === 'product-list' && (
          <ContentPanel
            title="لیست مدل"
            subtitle="مدیریت مدل‌ها و شناسه‌های کالا"
            action={
              <button className="accent-button" onClick={() => setActiveView('product-new')}>
                <Add />
                مدل جدید
              </button>
            }
          >
            <Toolbar
              onExport={() => exportCsv('models')}
              onSearch={setModelSearch}
              search={modelSearch}
            />
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
                  {filteredModels.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
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
                          <button className="mini-button orange" type="button">
                            <EditOutlined />
                            ویرایش
                          </button>
                          <button
                            className="mini-button red"
                            onClick={() =>
                              setModels((current) =>
                                current.filter((model) => model.id !== item.id),
                              )
                            }
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
            <PaginationSummary count={filteredModels.length} total={models.length} />
          </ContentPanel>
        )}

        {activeView === 'locations' && (
          <ContentPanel title="لیست محل کالا" subtitle="نمای سریع محل‌های انبار">
            <div className="location-grid">
              {['انبار مرکزی', 'محوطه دریافت', 'کنترل کیفیت', 'آماده ارسال'].map((location) => (
                <article className="location-card" key={location}>
                  <ArchiveOutlined />
                  <div>
                    <strong>{location}</strong>
                    <span>{Math.max(1, Math.floor(serials.length / 2))} قلم کالا</span>
                  </div>
                </article>
              ))}
            </div>
          </ContentPanel>
        )}
      </section>
    </main>
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
}: {
  search: string;
  onSearch: (value: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="table-toolbar">
      <div className="export-actions">
        <button className="success-button" type="button">
          <Upload />
          کپی
        </button>
        <button className="success-button" type="button">
          <Download />
          فایل اکسل
        </button>
        <button className="success-button" onClick={onExport} type="button">
          <Download />
          فایل CSV
        </button>
      </div>
      <label className="search-box">
        <Search />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="جستجو..."
        />
      </label>
    </div>
  );
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'green' | 'orange' }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function PaginationSummary({ count, total }: { count: number; total: number }) {
  return (
    <div className="pagination-row">
      <span>
        نمایش {count.toLocaleString('fa-IR')} از {total.toLocaleString('fa-IR')} ردیف
      </span>
      <div>
        <button type="button">قبلی</button>
        <button className="active-page" type="button">
          ۱
        </button>
        <button type="button">بعدی</button>
      </div>
    </div>
  );
}
