import type {
  LocationDraft,
  LocationSummary,
  ProductDraft,
  ProductModel,
  SerialDraft,
  SerialRecord,
} from '@/components/admin/types';
import { today } from '@/components/admin/persian-date';

export const emptyProductDraft: ProductDraft = {
  model: '',
  productCode: '',
  warrantyCode: '',
};

export const emptyLocationDraft: LocationDraft = {
  name: '',
  code: '',
};

export const createEmptySerialDraft = (): SerialDraft => ({
  date: today,
  documentNo: '',
  customerName: '',
  productCode: '',
  model: '',
  trackingCode: '',
  serialNo: '',
  movement: 'ورود',
});

export const seedModels: ProductModel[] = [
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

export const seedSerials: SerialRecord[] = [
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

export const seedLocations: LocationSummary[] = [
  { id: 'location-main', name: 'انبار مرکزی', code: 'MAIN', count: 2, isActive: true },
  { id: 'location-receive', name: 'محوطه دریافت', code: 'RECEIVE', count: 0, isActive: true },
  { id: 'location-qc', name: 'کنترل کیفیت', code: 'QC', count: 0, isActive: true },
  { id: 'location-ready', name: 'آماده ارسال', code: 'READY', count: 0, isActive: true },
];
