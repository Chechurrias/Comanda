// apps/mobile/src/core/database.ts
// Archivo puente temporal: SQLite eliminado para arquitectura 100% Cloud-First

export const initLocalDatabase = () => {
  // Sin operaciones locales: Todo opera directo en Supabase Cloud
};

export const localDbService: any = {
  getMenu: () => [],
  getAvailableMenu: () => [],
  getTables: () => [],
  getStaff: () => [],
  getActiveOrder: () => null,
  getDailySalesSummary: () => ({ total_sales: 0, orders_count: 0, average_ticket: 0 }),
  getSalesByPaymentMethod: () => [],
  getTopSellingItems: () => [],
  getPaidOrdersHistory: () => [],
  saveOrderItems: () => {},
  requestTableBill: () => {},
  payAndReleaseTable: () => {},
  addTable: () => {},
  deleteTable: () => {},
  toggleStaffStatus: () => {},
  verifyStaffPin: () => null,
};