export type ScannerStep = 'login' | 'document' | 'collect';
export type AcPart = 'motor' | 'panel' | null;

export type ProductModel = {
  id: string;
  model: string;
  productCode: string;
  warrantyCode: string;
  createdAt: string;
  updatedAt: string;
  status: 'فعال' | 'غیرفعال';
};

export type ScanRow = {
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

export type ScannerToast = {
  message: string;
  tone: 'success' | 'error';
};

export type ProductModelsResponse = {
  models: ProductModel[];
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
