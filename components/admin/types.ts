export type ViewId = 'serial-new' | 'serial-list' | 'product-new' | 'product-list' | 'locations';
export type MovementType = 'ورود' | 'خروج';
export type ScanMode = 'lookup' | 'inbound' | 'outbound';
export type SerialStatus = 'ثبت شده' | 'خروج شده';

export type ProductModel = {
  id: string;
  model: string;
  productCode: string;
  warrantyCode: string;
  createdAt: string;
  updatedAt: string;
  status: 'فعال' | 'غیرفعال';
};

export type SerialRecord = {
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

export type LocationSummary = {
  id: string;
  name: string;
  code: string;
  count: number;
  isActive: boolean;
};

export type BootstrapData = {
  locations: LocationSummary[];
  models: ProductModel[];
  serials: SerialRecord[];
};

export type AuthUser = {
  role: string;
  username: string;
};

export type SessionResponse =
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      user: AuthUser;
    };

export type LoginResponse = {
  ok: true;
  user: AuthUser;
};

export type ProductDraft = {
  id?: string;
  model: string;
  productCode: string;
  warrantyCode: string;
};

export type SerialDraft = {
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

export type LocationDraft = {
  id?: string;
  name: string;
  code: string;
};

export type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

export type PersianDateParts = {
  year: number;
  month: number;
  day: number;
};

export type ProductModelResponse = {
  model: ProductModel;
};

export type SerialRecordResponse = {
  serial: SerialRecord;
};

export type LocationResponse = {
  location: LocationSummary;
};

export type ScanResponse = {
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

export type ScanContext = {
  model: ProductModel | null;
  trackingCode: string;
};
