import { apiRequest } from "../../../lib/api/client";

export type AuditIssue = { code: string; label: string; count: number };
export type AuditPreview = {
  businessDate: string;
  nextBusinessDate: string;
  lastClosedDate: string | null;
  closeAllowedAt: string;
  closeWindowOpen: boolean;
  blockers: AuditIssue[];
  warnings: AuditIssue[];
  summary: {
    arrivals: number;
    departures: number;
    inHouse: number;
    soldRoomNights: number;
    roomRevenue: number;
    paymentsReceived: number;
    refundsPaid: number;
  };
  previewToken: string;
};

export type AuditClose = {
  businessDate: string;
  nextBusinessDate: string;
  closedAt: string;
};

export type AuditState = {
  initialized: boolean;
  startDate: string | null;
  firstClosedDate: string | null;
  closedCount: number;
  businessDate: string | null;
  lastClosedDate: string | null;
  recoveryRequired: boolean;
  recoveryReason: "missing_setup" | "date_gap" | "start_date_mismatch" | null;
  closeAllowedAt: string | null;
  closeWindowOpen: boolean;
};

export type AuditHistoryItem = {
  id: string;
  businessDate: string;
  closedAt: string;
  closedBy: string;
};

export type AuditHistory = {
  items: AuditHistoryItem[];
  total: number;
  page: number;
  limit: number;
};

export type AuditDetail = AuditHistoryItem & {
  snapshot: AuditPreview & { warningReason?: string | null };
  corrections: Array<{
    id: string;
    actorName: string;
    reason: string;
    createdAt: string;
    delta: FinancialSummary;
  }>;
  financialReconciliation: {
    original: FinancialSummary;
    accepted: FinancialSummary;
    actual: FinancialSummary;
    pendingDelta: FinancialSummary;
    previewToken: string;
  };
};

export type FinancialSummary = Pick<AuditPreview["summary"], "roomRevenue" | "paymentsReceived" | "refundsPaid">;

export type AuditDateContext = {
  calendarDate: string;
  businessDate: string | null;
  lastClosedDate: string | null;
  recoveryRequired: boolean;
};

export function getAuditDateContext(signal?: AbortSignal) {
  return apiRequest<AuditDateContext>("night-audit/date-context", { signal });
}

export function confirmAuditCorrection(businessDate: string, reason: string, previewToken: string) {
  return apiRequest(`night-audit/history/${encodeURIComponent(businessDate)}/corrections`, {
    method: "POST",
    body: { reason, previewToken },
  });
}

export function getAuditState(signal?: AbortSignal) {
  return apiRequest<AuditState>("night-audit/state", { signal });
}

export function setupAudit(startDate: string) {
  return apiRequest<AuditState>("night-audit/setup", {
    method: "POST",
    body: { startDate, confirm: true },
  });
}

export function getAuditPreview(signal?: AbortSignal) {
  return apiRequest<AuditPreview>("night-audit/preview", { signal });
}

export function getAuditHistory(page: number, signal?: AbortSignal) {
  return apiRequest<AuditHistory>(`night-audit/history?page=${page}&limit=20`, {
    signal,
  });
}

export function getAuditDetail(businessDate: string, signal?: AbortSignal) {
  return apiRequest<AuditDetail>(
    `night-audit/history/${encodeURIComponent(businessDate)}`,
    { signal },
  );
}

export function closeAudit(input: {
  businessDate: string;
  previewToken: string;
  warningReason?: string;
}) {
  return apiRequest<AuditClose>("night-audit/close", {
    method: "POST",
    body: { ...input, confirm: true },
  });
}
