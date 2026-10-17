import { apiRequest } from "../../../lib/api/client";

export type ManagerDailyMetrics = {
  availableRooms: number;
  soldRoomNights: number;
  occupancy: number;
  adr: number;
  revpar: number;
  roomRevenue: number;
  paymentsReceived: number;
  refundsPaid: number;
  netPayments: number;
  receivablesAtCapture: number;
  noShows: number;
  roomsNotReadyAtCapture: number;
};

export type ManagerDailyReport = {
  businessDate: string;
  status: "provisional" | "final" | "legacy_unavailable";
  closedAt: string | null;
  capturedAt: string | null;
  metrics: ManagerDailyMetrics | null;
  breakdown: {
    roomTypes: {
      roomTypeId: string;
      name: string;
      availableRooms: number;
      soldRoomNights: number;
      occupancy: number;
      roomRevenue: number;
      adr: number;
      revpar: number;
    }[];
    paymentMethods: {
      methodId: string;
      name: string;
      paymentsReceived: number;
      refundsPaid: number;
      netPayments: number;
    }[];
    receivablesByStatus: {
      status: string;
      reservations: number;
      amount: number;
    }[];
  } | null;
  correction: {
    count: number;
    roomRevenueDelta: number;
    paymentsReceivedDelta: number;
    refundsPaidDelta: number;
  } | null;
};

export function getManagerDailyReport(date: string, signal?: AbortSignal) {
  return apiRequest<ManagerDailyReport>(
    `reports/manager-daily?date=${encodeURIComponent(date)}`,
    { signal },
  );
}
