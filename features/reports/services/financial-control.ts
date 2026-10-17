import { apiRequest } from "../../../lib/api/client";

export type AgingBucket = "0_30" | "31_60" | "61_90" | "over_90";
export type ArAgingReport = {
  asOfDate: string;
  capturedAt: string;
  basis: "checkout_date";
  summary: {
    totalReservations: number;
    totalBalance: number;
    buckets: { key: AgingBucket; count: number; amount: number }[];
  };
  items: {
    id: string;
    bookingCode: string;
    source: string;
    checkedOutAt: string | null;
    checkOutDate: string;
    guestName: string;
    balance: number;
    ageDays: number;
  }[];
  page: number;
  limit: number;
  total: number;
};

export type DepositReconciliation = {
  capturedAt: string;
  historicalAsOfSupported: false;
  summary: {
    deposits: number;
    held: number;
    refunded: number;
    deducted: number;
    balance: number;
    unmatched: number;
  };
  items: {
    id: string;
    reservationId: string;
    bookingCode: string;
    reservationStatus: string;
    guestName: string;
    methodName: string | null;
    status: string;
    held: number;
    refunded: number;
    deducted: number;
    balance: number;
    ledgerMatched: boolean;
    updatedAt: string;
  }[];
  page: number;
  limit: number;
  total: number;
};

export type DepositMovements = {
  capturedAt: string;
  items: {
    id: string;
    depositId: string;
    reservationId: string;
    bookingCode: string;
    guestName: string;
    eventType: string;
    occurredAt: string;
    held: number;
    refunded: number;
    deducted: number;
    damageAmount: number;
    deductionPurpose: "balance" | "damage" | null;
    reason: string | null;
    reference: string | null;
  }[];
  page: number;
  limit: number;
  total: number;
};

export const getArAgingReport = (
  query: URLSearchParams,
  signal?: AbortSignal,
) => apiRequest<ArAgingReport>(`reports/ar-aging?${query}`, { signal });

export const getDepositReconciliation = (
  query: URLSearchParams,
  signal?: AbortSignal,
) =>
  apiRequest<DepositReconciliation>(`reports/deposit-reconciliation?${query}`, {
    signal,
  });

export const getDepositMovements = (
  query: URLSearchParams,
  signal?: AbortSignal,
) =>
  apiRequest<DepositMovements>(
    `reports/deposit-reconciliation/movements?${query}`,
    { signal },
  );
