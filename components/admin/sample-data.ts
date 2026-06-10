// Local fallback data for the admin dashboard.
// Production data must come from the database APIs, so the exported seed arrays
// intentionally stay empty. Keep the commented examples below only as a local
// reference when manually testing UI states.

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

export const seedModels: ProductModel[] = [];
export const seedSerials: SerialRecord[] = [];
export const seedLocations: LocationSummary[] = [];

// Example local seed data, disabled on purpose:
//
// export const seedModels: ProductModel[] = [
//   {
//     id: 'model-1',
//     model: 'BRH-09TP',
//     productCode: '2800003908970',
//     warrantyCode: '0',
//     createdAt: '۱۴۰۲/۰۵/۰۵',
//     updatedAt: '۱۴۰۲/۰۵/۰۵',
//     status: 'ثبت شده',
//   },
// ];
//
// export const seedSerials: SerialRecord[] = [
//   {
//     id: 'serial-1',
//     date: '۱۴۰۲/۰۴/۱۴',
//     documentNo: '1001',
//     customerName: 'انبار مرکزی',
//     productCode: '2800003908970',
//     model: 'BRH-09TP',
//     trackingCode: 'TR-1001',
//     serialNo: '2800003908970-001',
//     movement: 'ورود',
//     createdAt: '۱۴۰۲/۰۴/۱۴',
//     createdBy: 'admin',
//     updatedAt: '',
//     updatedBy: '-',
//     status: 'ثبت شده',
//   },
// ];
//
// export const seedLocations: LocationSummary[] = [
//   { id: 'location-main', name: 'انبار مرکزی', code: 'MAIN', count: 0, isActive: true },
// ];
