export type TenantStatus = 'active' | 'suspended' | 'terminated';
export type LicenseStatus = 'active' | 'grace' | 'restricted' | 'suspended' | 'terminated';
export type UserRole = 'super_admin' | 'restaurant_admin' | 'waiter';

export interface Plan {
  id: string;
  code: string;
  name: string;
  maxDevices: number;
  maxWaiters: number;
  maxTables: number;
}

export interface License {
  id: string;
  tenantId: string;
  planId: string;
  planName: string;
  status: LicenseStatus;
  startsAt: string;
  expiresAt: string;
  graceEndsAt?: string;
  licenseVersion: number;
}

export interface TenantWithLicense {
  id: string;
  legalName: string;
  tradeName: string;
  taxId: string; // NIT / RUC / CIF
  status: TenantStatus;
  license: License;
  createdAt: string;
}

export interface CreateTenantDTO {
  legalName: string;
  tradeName: string;
  taxId: string;
  planId: string;
  adminEmail: string;
  adminFullName: string;
}