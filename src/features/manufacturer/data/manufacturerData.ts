// ---------------------------------------------------------------------------
// Manufacturer dashboard data layer.
// All data-related logic lives here, separate from the UI components, so it
// can later be replaced with real backend API calls (keep the same shapes).
// ---------------------------------------------------------------------------

export interface Shipment {
  id: string;
  dealer: string;
  route: string;
  status: string;
}

export interface StockPoint {
  label: string;
  value: number;
}

export interface BatchSlice {
  name: 'Active' | 'Expired' | 'Recalled';
  value: number;
}

export interface ManufacturerStats {
  totalProducts: number;
  activeBatches: number;
  lowStockItems: number;
  pendingShipments: number;
  totalProductsTrend: number;
  activeBatchesTrend: number;
  lowStockTrend: number;
  pendingShipmentsTrend: number;
}

export interface ManufacturerDashboardData {
  stats: ManufacturerStats;
  shipments: Shipment[];
  stock: StockPoint[];
  batches: BatchSlice[];
}

// ----------------------------- Mock datasets -------------------------------

export const mockStats: ManufacturerStats = {
  totalProducts: 128,
  activeBatches: 34,
  lowStockItems: 7,
  pendingShipments: 12,
  totalProductsTrend: 12.5,
  activeBatchesTrend: 5.2,
  lowStockTrend: 8.1,
  pendingShipmentsTrend: 3.4,
};

export const mockShipments: Shipment[] = [
  { id: 'SHIP-MTAZSD1I8CNA3V', dealer: 'suvatikka (dealer)', route: 'Bangalore', status: 'ASSIGNED_TO_DEALER' },
  { id: 'SHIP-MTK9QW2PLORD7X', dealer: 'medex supplies (dealer)', route: 'Mumbai', status: 'ASSIGNED_TO_DEALER' },
  { id: 'SHIP-MTR4TG8HZKQ21B', dealer: 'healwell distributors (dealer)', route: 'Hyderabad', status: 'IN_TRANSIT' },
  { id: 'SHIP-MTB7VD5NXJWQ6C', dealer: 'citycare pharma (dealer)', route: 'Chennai', status: 'DELIVERED' },
  { id: 'SHIP-MTF3JN9SRTA84D', dealer: 'lifeline agency (dealer)', route: 'Pune', status: 'ASSIGNED_TO_DEALER' },
];

export const mockStock: StockPoint[] = [
  { label: 'Total Stock', value: 48250 },
  { label: 'Low Stock', value: 3120 },
];

export const mockBatches: BatchSlice[] = [
  { name: 'Active', value: 34 },
  { name: 'Expired', value: 6 },
  { name: 'Recalled', value: 2 },
];

// --------------------------- Simulated data API ----------------------------

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches everything the manufacturer dashboard needs.
 * Currently resolves from the mock datasets above after a short simulated
 * network delay. Swap the bodies of these functions for real `fetch` calls
 * (e.g. `/api/manufacturer/dashboard`) without touching the UI.
 */
export async function fetchManufacturerDashboardData(): Promise<ManufacturerDashboardData> {
  await delay(700);
  return {
    stats: mockStats,
    shipments: mockShipments,
    stock: mockStock,
    batches: mockBatches,
  };
}
