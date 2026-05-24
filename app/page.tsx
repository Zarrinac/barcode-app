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
import Image from 'next/image';
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

function persianDateKey(value: string) {
  const parts = parsePersianDate(value);

  if (!parts) {
    return null;
  }

  return parts.year * 10000 + parts.month * 100 + parts.day;
}

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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const adminUi = {
  loginShell:
    'grid min-h-screen place-items-center bg-gradient-to-br from-dcode-bg from-0% via-[#111111] via-[44%] to-dcode-light to-[44.2%] p-8 font-sans text-dcode-ink max-[680px]:p-4',
  loginCard:
    'grid w-[min(960px,100%)] grid-cols-2 items-center overflow-hidden rounded-[28px] border border-white/35 bg-white/75 shadow-[0_28px_80px_rgb(9_23_33_/_22%)] backdrop-blur-[18px] max-[680px]:grid-cols-1',
  loginVisual:
    'relative grid min-h-[460px] place-items-center overflow-hidden bg-dcode-bg max-[680px]:min-h-[220px]',
  loginBrandLogo: 'relative z-[1] h-auto w-[min(340px,76%)] max-[680px]:w-[min(250px,70%)]',
  loginForm:
    'relative grid gap-[18px] bg-gradient-to-b from-white/90 to-white/65 px-16 py-[70px] before:text-[28px] before:font-black before:text-dcode-bg before:content-["ورود_به_سامانه"] after:-mt-2.5 after:mb-2 after:text-[13px] after:font-bold after:text-slate-500 after:content-["مدیریت_سریع_ورود_و_خروج_کالا_با_اسکن_بارکد"] max-[680px]:px-6 max-[680px]:py-8',
  loginField: 'relative grid gap-[7px] text-[13px] font-bold text-slate-600',
  loginFieldIcon: 'absolute right-[18px] bottom-[13px] !size-[1.15em] text-dcode-red',
  loginInput:
    'h-[54px] w-full rounded-full border-0 bg-slate-50 px-3 pr-12 text-dcode-ink outline-none transition focus:border-dcode-red focus:shadow-[0_0_0_4px_rgb(255_43_61_/_11%)]',
  statusMessage:
    '-mt-1 mb-3.5 rounded-xl border border-dcode-red/20 bg-[#fff1f3] px-4 py-3 font-extrabold text-[#c70f20]',
  primaryButton:
    'inline-flex min-h-[42px] items-center justify-center gap-[7px] rounded-xl border-0 bg-gradient-to-br from-dcode-red to-[#c70f20] px-[18px] font-extrabold text-white shadow-[0_10px_20px_rgb(15_35_52_/_14%)] transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-[0_12px_24px_rgb(15_35_52_/_17%)] disabled:cursor-wait disabled:opacity-70',
  loginButton: 'mt-1 h-14 rounded-full',
  button:
    'inline-flex min-h-[42px] items-center justify-center gap-[7px] rounded-xl border-0 px-[18px] font-extrabold text-white shadow-[0_10px_20px_rgb(15_35_52_/_14%)] transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-[0_12px_24px_rgb(15_35_52_/_17%)] disabled:cursor-wait disabled:opacity-70 max-[380px]:px-3',
  buttonRed: 'bg-gradient-to-br from-dcode-red to-[#c70f20]',
  buttonDark: 'bg-gradient-to-br from-[#111111] to-dcode-bg',
  buttonGold: 'bg-gradient-to-br from-[#d6a100] to-[#a87900]',
  ghostButton: 'bg-white/15 shadow-none',
  ghostPanelButton:
    'inline-flex min-h-[42px] items-center justify-center rounded-xl border border-dcode-line bg-white px-[18px] font-black text-dcode-bg',
  miniButton:
    'inline-flex min-h-9 items-center justify-center gap-[7px] rounded-[10px] border-0 px-3 text-xs font-extrabold text-white shadow-[0_10px_20px_rgb(15_35_52_/_14%)] transition hover:-translate-y-px hover:saturate-[1.08]',
  appShell:
    'grid min-h-screen grid-cols-[260px_minmax(0,1fr)] gap-[18px] p-4 font-sans text-dcode-ink max-[980px]:grid-cols-1 max-[980px]:p-2.5 max-[680px]:gap-2.5 max-[680px]:p-2 max-[380px]:p-1.5',
  sidebar:
    'sticky top-4 flex h-[calc(100vh-32px)] flex-col gap-[22px] rounded-[18px] border border-white/10 bg-gradient-to-b from-[#151b27] to-[#05070c] px-[18px] py-6 text-white shadow-[0_18px_42px_rgb(12_18_30_/_10%)] max-[980px]:static max-[980px]:h-auto max-[680px]:gap-3.5 max-[680px]:rounded-2xl max-[680px]:p-4 max-[680px]:px-3.5',
  brand:
    'flex items-center justify-between gap-3 border-b border-white/15 pb-[22px] max-[680px]:pb-3.5',
  brandText: 'block text-[15px] font-bold',
  brandSubtext: 'mt-1.5 block text-xs text-white/60',
  brandLogo: 'h-auto w-28',
  navList: 'grid gap-2 max-[980px]:grid-cols-2 max-[680px]:grid-cols-1',
  navItem:
    'flex h-[52px] items-center gap-2.5 rounded-xl border-0 bg-transparent px-3.5 text-right text-white/85 transition hover:-translate-x-0.5 hover:bg-dcode-red/15 hover:text-white max-[680px]:h-[46px] max-[680px]:rounded-[10px] max-[680px]:hover:translate-x-0',
  navItemActive: 'bg-dcode-red/15 text-white shadow-[inset_3px_0_0_#ff2b3d]',
  workspace: 'flex min-w-0 flex-col gap-4',
  topbar:
    'flex min-h-[58px] items-center justify-between gap-3.5 rounded-2xl border border-white/25 bg-gradient-to-br from-dcode-bg to-[#111111] px-[18px] text-white shadow-[0_10px_26px_rgb(12_18_30_/_7%)] max-[680px]:min-h-0 max-[680px]:flex-col max-[680px]:items-stretch max-[680px]:p-3.5',
  userLine: 'flex items-center gap-2 font-bold max-[680px]:flex-wrap',
  statsGrid: 'grid grid-cols-2 gap-3 max-[980px]:grid-cols-2 max-[680px]:gap-2.5',
  statCard:
    'min-h-[86px] rounded-2xl border border-dcode-bg/10 border-t-4 border-t-dcode-red bg-white p-4 shadow-[0_10px_26px_rgb(12_18_30_/_7%)] max-[680px]:min-h-[74px] max-[680px]:px-3.5 max-[680px]:py-3',
  statLabel: 'block text-[13px] text-slate-500',
  statValue: 'mt-2 block text-3xl leading-none font-black max-[680px]:text-2xl',
  contentPanel:
    'min-h-[520px] rounded-[18px] border border-dcode-bg/10 bg-white p-[26px] shadow-[0_18px_42px_rgb(12_18_30_/_10%)] max-[680px]:min-h-0 max-[680px]:min-w-0 max-[680px]:rounded-2xl max-[680px]:p-4 max-[380px]:p-3.5',
  panelHeading:
    'mb-6 flex items-start justify-between gap-4 max-[680px]:mb-[18px] max-[680px]:flex-col max-[680px]:items-stretch max-[680px]:gap-3',
  panelTitle:
    'm-0 text-[clamp(28px,4vw,44px)] font-black text-dcode-bg max-[680px]:text-[26px] max-[680px]:leading-tight',
  panelSubtitle: 'mt-2 text-slate-500 max-[680px]:text-[13px]',
  emptyAction:
    'grid min-h-80 place-items-center content-center gap-[18px] rounded-[18px] border border-dashed border-dcode-red/30 bg-gradient-to-b from-white to-slate-50 text-center text-dcode-bg max-[680px]:min-h-[220px] max-[680px]:p-[18px]',
  compactEmpty: 'mr-auto max-w-[560px]',
  emptyIcon: '!size-[46px] text-dcode-red',
  emptyTitle: 'text-lg font-bold',
  scanPanel: 'grid w-[min(760px,100%)] gap-4 max-[680px]:w-full',
  scanModeGroup:
    'grid grid-cols-3 gap-2.5 rounded-2xl border border-dcode-line bg-slate-50 p-1.5 max-[680px]:rounded-[14px]',
  scanMode: 'min-h-[46px] rounded-xl border-0 bg-transparent font-black text-slate-500',
  scanModeActive:
    'bg-gradient-to-br from-dcode-red to-[#c70f20] text-white shadow-[0_10px_22px_rgb(255_43_61_/_18%)]',
  adminScanForm:
    'grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-[18px] border border-dcode-bg/12 bg-gradient-to-b from-white to-slate-50 p-[18px] shadow-[0_10px_26px_rgb(12_18_30_/_7%)] max-[680px]:grid-cols-1 max-[680px]:rounded-[14px] max-[680px]:p-3.5',
  adminScanInputWrap: 'relative grid gap-2 text-[13px] font-extrabold text-slate-600',
  adminScanIcon: 'absolute right-3.5 bottom-3.5 !size-[22px] text-dcode-red',
  adminScanInput:
    'h-[58px] w-full rounded-[14px] border border-dcode-bg/12 bg-white px-3.5 pr-12 text-lg font-black text-dcode-bg uppercase outline-none focus:border-dcode-red focus:shadow-[0_0_0_5px_rgb(255_43_61_/_11%)] max-[680px]:h-14 max-[680px]:text-base',
  scanResult:
    'grid gap-3 rounded-[18px] border border-dcode-bg/12 bg-slate-50 p-4 max-[680px]:p-3.5',
  scanResultWarn: 'border-[#d6a100]/35 bg-[#fffaf2]',
  scanResultHeader: 'grid gap-1.5',
  scanResultLabel: 'text-xs font-extrabold text-slate-500',
  scanResultValue: '[overflow-wrap:anywhere] text-lg font-bold text-dcode-bg',
  scanResultMessage: 'm-0 font-black text-[#c70f20]',
  scanResultWarnMessage: 'text-[#9a640b]',
  scanResultGrid: 'grid gap-0.5 border-t border-slate-200 pt-1',
  scanSecondaryActions: 'flex flex-wrap gap-2.5',
  toolbar:
    'mb-4 flex items-end justify-between gap-4 max-[680px]:flex-col max-[680px]:items-stretch',
  exportActions: 'flex flex-wrap gap-2 max-[680px]:w-full',
  searchBox:
    'relative grid min-w-[500px] gap-[7px] text-[13px] font-bold text-slate-500 max-[680px]:min-w-0 max-[680px]:w-full',
  searchIcon: 'absolute right-3 bottom-3 !size-[1.15em] text-slate-500',
  searchInput:
    'h-11 w-full rounded-[10px] border border-slate-300 bg-slate-50 px-3 pr-[38px] text-dcode-ink outline-none focus:border-dcode-red focus:shadow-[0_0_0_4px_rgb(255_43_61_/_11%)]',
  serialDateFilters:
    'my-[18px] mb-5 grid w-full grid-cols-[250px_300px_300px_1fr_250px] items-end gap-x-[18px] gap-y-6 rounded-2xl border border-slate-300/80 bg-gradient-to-b from-white to-slate-50 px-4 py-3.5 shadow-[0_12px_28px_rgb(15_35_52_/_7%)] max-[680px]:grid-cols-1',
  serialDateCaption:
    'col-start-1 ml-3 self-center whitespace-nowrap text-[15px] font-black text-dcode-bg before:ml-2 before:inline-block before:size-2 before:rounded-full before:bg-dcode-red before:shadow-[0_0_0_4px_rgb(255_43_61_/_12%)]',
  serialDateClear:
    'col-start-5 min-h-11 whitespace-nowrap rounded-[10px] px-3.5 shadow-none max-[680px]:col-start-auto',
  tableOptions: 'mb-3.5 -mt-1 flex justify-start max-[680px]:justify-end',
  tableWrap:
    'max-h-[min(62vh,680px)] overflow-auto rounded-[14px] border border-dcode-line bg-white shadow-[inset_0_1px_0_rgb(255_255_255_/_85%)] [scrollbar-gutter:stable_both-edges] max-[680px]:hidden',
  table:
    'w-full min-w-[980px] border-separate border-spacing-0 text-slate-600 [&_td]:whitespace-nowrap [&_td]:border-b [&_td]:border-l [&_td]:border-slate-100 [&_td]:px-3.5 [&_td]:py-3 [&_td]:text-right [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-l [&_th]:border-slate-100 [&_th]:bg-slate-100 [&_th]:px-3.5 [&_th]:py-3 [&_th]:text-right [&_th]:text-[13px] [&_th]:font-black [&_th]:text-slate-700 [&_tbody_tr:nth-child(odd)]:bg-white [&_tbody_tr:nth-child(even)]:bg-slate-50 [&_tbody_tr:hover]:bg-[#fff1f3]',
  serialTable: 'min-w-[1720px] [&_td:nth-child(8)]:min-w-[250px] [&_th:nth-child(8)]:min-w-[250px]',
  mobileRecordList: 'hidden gap-3 max-[680px]:grid',
  recordCard:
    'grid gap-3.5 rounded-2xl border border-dcode-line bg-gradient-to-b from-white to-slate-50 p-3.5 shadow-[0_10px_26px_rgb(12_18_30_/_7%)]',
  recordCardHeader: 'flex items-center justify-between gap-3 border-b border-slate-200 pb-2.5',
  recordCardTitle: 'min-w-0 [overflow-wrap:anywhere] text-base font-bold text-dcode-bg',
  recordCardIndex: 'shrink-0 font-black text-[#c70f20]',
  recordCardGrid: 'grid gap-0.5',
  recordCardFooter: 'flex items-start justify-between gap-3 pt-0.5 max-[680px]:flex-col',
  recordField:
    'flex min-h-[34px] items-center justify-between gap-3 border-b border-slate-100 py-[7px] last:border-b-0',
  recordFieldLabel: 'text-xs font-extrabold text-slate-500',
  recordFieldValue:
    'min-w-0 text-left text-[13px] font-[850] text-slate-700 [overflow-wrap:anywhere] [unicode-bidi:plaintext]',
  emptyRecords:
    'm-0 rounded-[14px] border border-dashed border-dcode-red/30 bg-slate-50 p-[18px] text-center font-extrabold text-slate-500',
  rowActions: 'flex gap-2 max-[680px]:w-full max-[680px]:flex-wrap',
  statusPill:
    'inline-flex h-[34px] min-w-[78px] items-center justify-center rounded-full text-xs font-black text-white',
  statusGreen: 'bg-gradient-to-br from-dcode-red to-[#c70f20]',
  statusOrange: 'bg-gradient-to-br from-[#d6a100] to-[#a87900]',
  paginationRow:
    'mt-4 flex items-center justify-between gap-4 font-bold text-slate-500 max-[680px]:flex-col max-[680px]:items-stretch',
  paginationStatus: 'text-center max-[680px]:text-right',
  paginationControls:
    'flex flex-wrap items-center justify-end gap-2 [direction:ltr] max-[680px]:justify-center',
  paginationButton:
    'h-[34px] min-w-[34px] rounded-[7px] border-0 bg-transparent font-extrabold text-slate-600 disabled:cursor-not-allowed disabled:opacity-45',
  pageNumber: 'min-w-9 bg-slate-100 px-2.5',
  activePage: 'min-w-9 bg-[#fff1f3] px-2.5 text-[#c70f20]',
  paginationEllipsis:
    'inline-flex h-[34px] min-w-6 items-center justify-center font-black text-slate-500',
  pageSizeControl: 'flex items-center gap-2 max-[680px]:w-full',
  pageSizeLabel: 'whitespace-nowrap',
  pageSizeSelect:
    'h-9 min-w-[76px] rounded-[9px] border border-slate-300 bg-slate-50 px-2.5 font-black text-dcode-ink',
  locationGrid: 'grid grid-cols-4 gap-3.5 max-[980px]:grid-cols-2 max-[680px]:grid-cols-1',
  locationCard:
    'flex min-h-[116px] items-center justify-between gap-3.5 rounded-2xl border border-dcode-line bg-gradient-to-b from-white to-slate-50 p-[18px] shadow-[0_10px_26px_rgb(12_18_30_/_7%)] max-[680px]:grid max-[680px]:min-h-24 max-[680px]:grid-cols-[auto_minmax(0,1fr)] max-[680px]:justify-stretch max-[680px]:p-4',
  locationIcon: '!size-[34px] text-dcode-red max-[680px]:!size-[30px]',
  locationBody: 'min-w-0 flex-1',
  locationTitle:
    'block text-base font-bold max-[680px]:text-[15px] max-[680px]:[overflow-wrap:anywhere]',
  locationMeta: 'mt-1.5 block text-[13px] text-slate-500',
  modalBackdrop:
    'fixed inset-0 z-50 grid place-items-center bg-dcode-bg/65 p-[22px] backdrop-blur-[10px] max-[680px]:items-start max-[680px]:overflow-auto max-[680px]:p-2.5 max-[380px]:p-2',
  modalCard:
    'max-h-[min(860px,calc(100vh-44px))] w-[min(560px,100%)] overflow-auto rounded-[22px] border border-white/70 bg-gradient-to-b from-white to-slate-50 shadow-[0_34px_90px_rgb(9_23_33_/_34%)] max-[680px]:max-h-none max-[680px]:w-full max-[680px]:rounded-[18px]',
  modalCardWide: 'w-[min(860px,100%)]',
  modalHeading:
    'sticky top-0 z-[1] flex items-start justify-between gap-3.5 border-b border-dcode-line bg-gradient-to-b from-white to-slate-50 px-6 py-[22px] max-[680px]:gap-2.5 max-[680px]:px-4 max-[680px]:py-[18px] max-[380px]:px-3.5',
  modalTitle:
    'm-0 text-2xl font-black text-dcode-bg max-[680px]:text-[22px] max-[680px]:leading-tight',
  modalSubtitle:
    'mt-2 text-[13px] font-bold text-slate-500 max-[680px]:text-xs max-[680px]:leading-[1.8]',
  modalClose:
    'h-[38px] w-[38px] rounded-xl border-0 bg-slate-100 text-2xl leading-none text-dcode-bg max-[680px]:h-9 max-[680px]:w-9',
  modalForm:
    'grid grid-cols-1 gap-4 p-6 max-[680px]:gap-3.5 max-[680px]:px-4 max-[680px]:py-[18px] max-[380px]:px-3.5',
  modalFormWide: 'grid-cols-2 max-[680px]:grid-cols-1',
  field: 'grid gap-[7px] text-[13px] font-bold text-slate-600',
  fieldWide: 'col-span-full',
  fieldInput:
    'h-11 w-full rounded-[10px] border border-slate-300 bg-slate-50 px-3 text-dcode-ink outline-none transition focus:border-dcode-red focus:shadow-[0_0_0_4px_rgb(255_43_61_/_11%)]',
  dateField: 'relative grid gap-[7px] text-[13px] font-bold text-slate-600',
  dateTrigger:
    'flex h-11 w-full items-center justify-between gap-2.5 rounded-[10px] border border-slate-300 bg-slate-50 px-3 text-right font-extrabold text-dcode-ink outline-none focus:border-dcode-red focus:shadow-[0_0_0_4px_rgb(255_43_61_/_11%)]',
  dateTriggerActive: 'border-dcode-red shadow-[0_0_0_4px_rgb(255_43_61_/_11%)]',
  dateTriggerEmpty: 'font-bold text-slate-500',
  dateIcon: '!size-[1.15em] text-dcode-red',
  calendar:
    'absolute top-[calc(100%+8px)] right-0 z-[5] w-[min(330px,88vw)] rounded-2xl border border-slate-300 bg-gradient-to-b from-white to-slate-50 p-3.5 shadow-[0_24px_60px_rgb(9_23_33_/_18%)] max-[680px]:w-[min(300px,calc(100vw-52px))]',
  calendarHeader: 'mb-3 flex items-center justify-between gap-2.5',
  calendarTitle: 'text-[15px] text-dcode-bg',
  calendarNavButton:
    'h-[34px] w-[34px] rounded-[10px] border-0 bg-slate-100 text-[22px] font-black text-dcode-bg',
  calendarGrid: 'grid grid-cols-7 gap-1.5',
  calendarWeekday: 'grid h-[26px] place-items-center text-xs font-black text-slate-500',
  calendarEmpty: 'h-[34px]',
  calendarDay:
    'grid h-[34px] place-items-center rounded-[10px] border-0 bg-slate-100 font-black text-dcode-bg hover:bg-dcode-red hover:text-white',
  calendarDaySelected: 'bg-dcode-red text-white',
  calendarToday: 'mt-3 h-9 w-full rounded-[10px] border-0 bg-[#fff1f3] font-black text-[#c70f20]',
  modalActions:
    'col-span-full mt-2 flex items-center justify-start gap-2.5 max-[680px]:flex-col-reverse max-[680px]:items-stretch',
  confirmActions:
    'flex items-center justify-start gap-2.5 p-6 max-[680px]:flex-col-reverse max-[680px]:items-stretch',
};

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
  const [serials, setSerials] = useState<SerialRecord[]>(seedSerials);
  const [locations, setLocations] = useState<LocationSummary[]>(seedLocations);
  const [dataSource, setDataSource] = useState<'sample' | 'database'>('sample');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [serialSearch, setSerialSearch] = useState('');
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
    const fromKey = persianDateKey(serialDateFrom);
    const toKey = persianDateKey(serialDateTo);

    return serials.filter((item) => {
      const matchesQuery =
        !query ||
        [item.documentNo, item.customerName].some((value) => value.toLowerCase().includes(query));
      const itemDateKey = persianDateKey(item.date);
      const matchesDateFrom = !fromKey || (itemDateKey !== null && itemDateKey >= fromKey);
      const matchesDateTo = !toKey || (itemDateKey !== null && itemDateKey <= toKey);

      return matchesQuery && matchesDateFrom && matchesDateTo;
    });
  }, [serialDateFrom, serialDateTo, serialSearch, serials]);

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
    return {
      models: models.length,
      serials: serials.length,
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
      setStatusMessage(error instanceof Error ? error.message : 'ورود ناموفق بود.');
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
      <main className={adminUi.loginShell} dir="rtl">
        <section className={adminUi.loginCard} aria-label="ورود به برنامه انبار">
          <div className={adminUi.loginVisual} aria-hidden="true">
            <Image
              className={adminUi.loginBrandLogo}
              src="/favicon/source/dcode-wordmark-light.png"
              alt=""
              width={736}
              height={185}
              priority
            />
          </div>

          <form className={adminUi.loginForm} onSubmit={login}>
            <label className={adminUi.loginField}>
              <span>نام کاربری</span>
              <LoginOutlined className={adminUi.loginFieldIcon} />
              <input
                className={adminUi.loginInput}
                name="username"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, username: event.target.value }))
                }
                autoComplete="username"
              />
            </label>
            <label className={adminUi.loginField}>
              <span>رمز عبور</span>
              <BadgeOutlined className={adminUi.loginFieldIcon} />
              <input
                className={adminUi.loginInput}
                name="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
                type="password"
                autoComplete="current-password"
              />
            </label>
            {statusMessage && <p className={adminUi.statusMessage}>{statusMessage}</p>}
            <button className={cx(adminUi.primaryButton, adminUi.loginButton)} type="submit">
              ورود
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className={adminUi.appShell} dir="rtl">
      <aside className={adminUi.sidebar} aria-label="منوی اصلی">
        <div className={adminUi.brand}>
          <div>
            <strong className={adminUi.brandText}>D&apos;CODE</strong>
            <span className={adminUi.brandSubtext}>سامانه انبار و سریال</span>
          </div>
          <Image
            className={adminUi.brandLogo}
            src="/favicon/source/dcode-wordmark-light.png"
            alt="D'CODE"
            width={147}
            height={37}
          />
        </div>

        <nav className={adminUi.navList}>
          {menuItems.map((item) => (
            <button
              className={cx(adminUi.navItem, activeView === item.id && adminUi.navItemActive)}
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

      <section className={adminUi.workspace}>
        <header className={adminUi.topbar}>
          <div className={adminUi.userLine}>
            <DashboardOutlined />
            <span>کاربر جاری: {currentUser?.username ?? '-'}</span>
          </div>
          <form onSubmit={logout}>
            <button className={cx(adminUi.button, adminUi.ghostButton)} type="submit">
              <Logout />
              خروج
            </button>
          </form>
        </header>

        <section className={adminUi.statsGrid} aria-label="خلاصه وضعیت انبار">
          <StatCard label="کل سریال" value={stats.serials} tone="green" />
          <StatCard label="مدل کالا" value={stats.models} tone="blue" />
        </section>

        {statusMessage && <p className={adminUi.statusMessage}>{statusMessage}</p>}

        {activeView === 'serial-new' && (
          <ContentPanel
            title="اسکن بارکد"
            subtitle="ثبت سریع ورود، خروج و استعلام"
            action={
              <button
                className={cx(adminUi.button, adminUi.buttonRed)}
                onClick={() => setActiveView('serial-list')}
              >
                مشاهده لیست
              </button>
            }
          >
            <section className={adminUi.scanPanel}>
              <div className={adminUi.scanModeGroup} aria-label="نوع عملیات اسکن">
                {scanModeOptions.map((option) => (
                  <button
                    className={cx(
                      adminUi.scanMode,
                      scanMode === option.id && adminUi.scanModeActive,
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
                <article className={adminUi.scanResult}>
                  <div className={adminUi.scanResultHeader}>
                    <span className={adminUi.scanResultLabel}>آماده برای ثبت سریال</span>
                    <strong className={adminUi.scanResultValue}>
                      {scanContext.model?.model ?? 'مدل انتخاب نشده'}
                    </strong>
                  </div>
                  <div className={adminUi.scanResultGrid}>
                    <RecordField label="شناسه کالا" value={scanContext.model?.productCode || '-'} />
                    <RecordField label="کد رهگیری" value={scanContext.trackingCode || '-'} />
                  </div>
                  <button
                    className={cx(adminUi.button, adminUi.buttonRed)}
                    onClick={() => setScanContext({ model: null, trackingCode: '' })}
                    type="button"
                  >
                    پاک کردن
                  </button>
                </article>
              )}

              <form className={adminUi.adminScanForm} onSubmit={submitScan}>
                <label className={adminUi.adminScanInputWrap}>
                  <span>بارکد</span>
                  <QrCodeScanner className={adminUi.adminScanIcon} />
                  <input
                    className={adminUi.adminScanInput}
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
                  className={cx(adminUi.button, adminUi.buttonRed)}
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
                    adminUi.scanResult,
                    scanResult.action === 'NOT_FOUND' && adminUi.scanResultWarn,
                  )}
                >
                  <div className={adminUi.scanResultHeader}>
                    <span className={adminUi.scanResultLabel}>آخرین اسکن</span>
                    <strong className={adminUi.scanResultValue}>{scanResult.barcode}</strong>
                  </div>
                  <p
                    className={cx(
                      adminUi.scanResultMessage,
                      scanResult.action === 'NOT_FOUND' && adminUi.scanResultWarnMessage,
                    )}
                  >
                    {scanResult.message}
                  </p>
                  {scanResult.serial && (
                    <div className={adminUi.scanResultGrid}>
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
                    <div className={adminUi.scanResultGrid}>
                      <RecordField label="مدل کالا" value={scanResult.matchedModel.model} />
                      <RecordField label="شناسه کالا" value={scanResult.matchedModel.productCode} />
                    </div>
                  )}
                </article>
              )}

              <div className={adminUi.scanSecondaryActions}>
                <button
                  className={cx(adminUi.button, adminUi.buttonRed)}
                  onClick={openSerialCreate}
                  type="button"
                >
                  <Add />
                  ثبت دستی
                </button>
                <button
                  className={adminUi.ghostPanelButton}
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
              <button
                className={cx(adminUi.button, adminUi.buttonRed)}
                onClick={openSerialCreate}
                type="button"
              >
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
            <div className={adminUi.serialDateFilters}>
              <span className={adminUi.serialDateCaption}>بازه تاریخ</span>
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
                className={cx(adminUi.button, adminUi.buttonRed, adminUi.serialDateClear)}
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
            <div className={adminUi.tableOptions}>
              <PageSizeControl
                onPageSizeChange={(value) => {
                  setSerialPageSize(value);
                  setSerialPage(1);
                }}
                pageSize={serialPageSize}
              />
            </div>
            <div className={adminUi.tableWrap}>
              <table className={cx(adminUi.table, adminUi.serialTable)}>
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
                        <div className={adminUi.rowActions}>
                          <button
                            className={cx(adminUi.miniButton, adminUi.buttonGold)}
                            onClick={() => updateSerial(item)}
                            type="button"
                          >
                            <EditOutlined />
                            ویرایش
                          </button>
                          <button
                            className={cx(adminUi.miniButton, adminUi.buttonDark)}
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
            <div className={adminUi.mobileRecordList} aria-label="لیست سریال‌ها">
              {paginatedSerials.length > 0 ? (
                paginatedSerials.map((item, index) => (
                  <article className={adminUi.recordCard} key={item.id}>
                    <div className={adminUi.recordCardHeader}>
                      <strong className={adminUi.recordCardTitle}>{item.serialNo}</strong>
                      <span className={adminUi.recordCardIndex}>
                        #{(serialPageStart + index + 1).toLocaleString('fa-IR')}
                      </span>
                    </div>
                    <div className={adminUi.recordCardGrid}>
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
                    <div className={adminUi.recordCardFooter}>
                      <StatusPill tone={item.status === 'ثبت شده' ? 'green' : 'orange'}>
                        {item.status}
                      </StatusPill>
                      <div className={adminUi.rowActions}>
                        <button
                          className={cx(adminUi.miniButton, adminUi.buttonGold)}
                          onClick={() => updateSerial(item)}
                          type="button"
                        >
                          <EditOutlined />
                          ویرایش
                        </button>
                        <button
                          className={cx(adminUi.miniButton, adminUi.buttonDark)}
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
                <p className={adminUi.emptyRecords}>رکوردی برای نمایش وجود ندارد.</p>
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
              <button
                className={cx(adminUi.button, adminUi.buttonRed)}
                onClick={() => setActiveView('product-list')}
              >
                مشاهده لیست
              </button>
            }
          >
            <div className={cx(adminUi.emptyAction, adminUi.compactEmpty)}>
              <Inventory2Outlined className={adminUi.emptyIcon} />
              <strong className={adminUi.emptyTitle}>
                فرم تعریف کالا در پنجره جداگانه باز می‌شود.
              </strong>
              <button
                className={cx(adminUi.button, adminUi.buttonRed)}
                onClick={openProductCreate}
                type="button"
              >
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
              <button
                className={cx(adminUi.button, adminUi.buttonRed)}
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
            <div className={adminUi.tableOptions}>
              <PageSizeControl
                onPageSizeChange={(value) => {
                  setModelPageSize(value);
                  setModelPage(1);
                }}
                pageSize={modelPageSize}
              />
            </div>
            <div className={adminUi.tableWrap}>
              <table className={adminUi.table}>
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
                        <div className={adminUi.rowActions}>
                          <button
                            className={cx(adminUi.miniButton, adminUi.buttonGold)}
                            onClick={() => updateModel(item)}
                            type="button"
                          >
                            <EditOutlined />
                            ویرایش
                          </button>
                          <button
                            className={cx(adminUi.miniButton, adminUi.buttonDark)}
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
            <div className={adminUi.mobileRecordList} aria-label="لیست مدل کالا">
              {paginatedModels.length > 0 ? (
                paginatedModels.map((item, index) => (
                  <article className={adminUi.recordCard} key={item.id}>
                    <div className={adminUi.recordCardHeader}>
                      <strong className={adminUi.recordCardTitle}>{item.model}</strong>
                      <span className={adminUi.recordCardIndex}>
                        #{(modelPageStart + index + 1).toLocaleString('fa-IR')}
                      </span>
                    </div>
                    <div className={adminUi.recordCardGrid}>
                      <RecordField label="شناسه کالا" value={item.productCode} />
                      <RecordField label="شناسه گارانتی" value={item.warrantyCode || '-'} />
                      <RecordField label="تاریخ ایجاد" value={item.createdAt} />
                      <RecordField label="تاریخ ویرایش" value={item.updatedAt} />
                    </div>
                    <div className={adminUi.recordCardFooter}>
                      <StatusPill tone="green">ثبت شده</StatusPill>
                      <div className={adminUi.rowActions}>
                        <button
                          className={cx(adminUi.miniButton, adminUi.buttonGold)}
                          onClick={() => updateModel(item)}
                          type="button"
                        >
                          <EditOutlined />
                          ویرایش
                        </button>
                        <button
                          className={cx(adminUi.miniButton, adminUi.buttonDark)}
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
                <p className={adminUi.emptyRecords}>رکوردی برای نمایش وجود ندارد.</p>
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
                className={cx(adminUi.button, adminUi.buttonRed)}
                onClick={openLocationCreate}
                type="button"
              >
                <Add />
                محل جدید
              </button>
            }
          >
            <div className={adminUi.locationGrid}>
              {locations.map((location) => (
                <article className={adminUi.locationCard} key={location.id}>
                  <ArchiveOutlined className={adminUi.locationIcon} />
                  <div className={adminUi.locationBody}>
                    <strong className={adminUi.locationTitle}>{location.name}</strong>
                    <span className={adminUi.locationMeta}>
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
          <form className={adminUi.modalForm} onSubmit={saveProduct}>
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
            className={cx(adminUi.modalForm, adminUi.modalFormWide)}
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
          <form className={adminUi.modalForm} onSubmit={saveLocation}>
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
          <div className={adminUi.confirmActions}>
            <button
              className={cx(adminUi.button, adminUi.buttonRed)}
              onClick={() => setConfirmDialog(null)}
              type="button"
            >
              انصراف
            </button>
            <button
              className={cx(adminUi.button, adminUi.buttonDark)}
              onClick={confirmDelete}
              type="button"
            >
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
    <div className={adminUi.modalBackdrop} role="presentation">
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className={cx(adminUi.modalCard, wide && adminUi.modalCardWide)}
        role="dialog"
      >
        <div className={adminUi.modalHeading}>
          <div>
            <h2 className={adminUi.modalTitle} id="modal-title">
              {title}
            </h2>
            <p className={adminUi.modalSubtitle}>{subtitle}</p>
          </div>
          <button className={adminUi.modalClose} onClick={onClose} type="button">
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
    <div className={adminUi.modalActions}>
      <button className={cx(adminUi.button, adminUi.buttonRed)} onClick={onCancel} type="button">
        انصراف
      </button>
      <button className={cx(adminUi.button, adminUi.buttonRed)} type="submit">
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
    <label className={adminUi.dateField}>
      <span>{label}</span>
      <button
        className={cx(
          adminUi.dateTrigger,
          isOpen && adminUi.dateTriggerActive,
          !value && adminUi.dateTriggerEmpty,
        )}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <CalendarMonthOutlined className={adminUi.dateIcon} />
        <span>{value || placeholder || today}</span>
      </button>
      {isOpen && (
        <div className={adminUi.calendar}>
          <div className={adminUi.calendarHeader}>
            <button
              className={adminUi.calendarNavButton}
              onClick={() => changeMonth(-1)}
              type="button"
            >
              ‹
            </button>
            <strong className={adminUi.calendarTitle}>
              {persianMonthNames[visibleMonth.month - 1]} {visibleMonth.year}
            </strong>
            <button
              className={adminUi.calendarNavButton}
              onClick={() => changeMonth(1)}
              type="button"
            >
              ›
            </button>
          </div>
          <div className={adminUi.calendarGrid}>
            {persianWeekDays.map((day) => (
              <span className={adminUi.calendarWeekday} key={day}>
                {day}
              </span>
            ))}
          </div>
          <div className={adminUi.calendarGrid}>
            {Array.from({ length: leadingCells }).map((_, index) => (
              <span className={adminUi.calendarEmpty} key={`empty-${index}`} />
            ))}
            {monthDates.map(({ parts }) => {
              const dateValue = formatPersianDateParts(parts);

              return (
                <button
                  className={cx(
                    adminUi.calendarDay,
                    dateValue === selectedValue && adminUi.calendarDaySelected,
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
            className={adminUi.calendarToday}
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
    <label className={cx(adminUi.field, wide && adminUi.fieldWide)}>
      <span>{label}</span>
      <input
        className={adminUi.fieldInput}
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
    <section className={adminUi.contentPanel}>
      <div className={adminUi.panelHeading}>
        <div>
          <h1 className={adminUi.panelTitle}>{title}</h1>
          <p className={adminUi.panelSubtitle}>{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={adminUi.statCard} data-tone={tone}>
      <span className={adminUi.statLabel}>{label}</span>
      <strong className={adminUi.statValue}>{value.toLocaleString('fa-IR')}</strong>
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
    <div className="bg-green-500 mb-4 flex items-start justify-between gap-4 flex-col md:flex-row md:items-start">
      <div className="flex gap-2 max-[680px]:w-full">
        <button
          className={cx(adminUi.button, adminUi.buttonRed, 'max-[680px]:w-full')}
          type="button"
        >
          <Upload />
          کپی
        </button>
        <button
          className={cx(adminUi.button, adminUi.buttonRed, 'max-[680px]:w-full')}
          onClick={onExport}
          type="button"
        >
          <Download />
          {exportLabel}
        </button>
      </div>
      <label className={adminUi.searchBox}>
        <Search className={adminUi.searchIcon} />
        <input
          className={adminUi.searchInput}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
        />
      </label>
    </div>
  );
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'green' | 'orange' }) {
  return (
    <span
      className={cx(
        adminUi.statusPill,
        tone === 'green' ? adminUi.statusGreen : adminUi.statusOrange,
      )}
    >
      {children}
    </span>
  );
}

function RecordField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={adminUi.recordField}>
      <span className={adminUi.recordFieldLabel}>{label}</span>
      <strong className={adminUi.recordFieldValue}>{value}</strong>
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
    <label className={adminUi.pageSizeControl}>
      <span className={adminUi.pageSizeLabel}>ردیف در هر صفحه</span>
      <select
        className={adminUi.pageSizeSelect}
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
    <div className={adminUi.paginationRow}>
      <span className={adminUi.paginationStatus}>
        نمایش {start.toLocaleString('fa-IR')} تا {end.toLocaleString('fa-IR')} از{' '}
        {filteredTotal.toLocaleString('fa-IR')} ردیف
        {hasFiltered ? ` (کل: ${total.toLocaleString('fa-IR')})` : ''}
      </span>
      <div className={adminUi.paginationControls}>
        <button
          className={adminUi.paginationButton}
          aria-label="صفحه بعدی"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          {'<'}
        </button>
        {paginationItems.map((item, index) =>
          item === 'ellipsis' ? (
            <span className={adminUi.paginationEllipsis} key={`ellipsis-${index}`}>
              ...
            </span>
          ) : (
            <button
              aria-current={item === page ? 'page' : undefined}
              className={cx(
                adminUi.paginationButton,
                item === page ? adminUi.activePage : adminUi.pageNumber,
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
          className={adminUi.paginationButton}
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
