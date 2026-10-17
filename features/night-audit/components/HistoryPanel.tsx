"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "../../../lib/auth";
import {
  confirmAuditCorrection,
  getAuditDetail,
  getAuditHistory,
  type AuditDetail,
  type AuditHistory,
} from "../services/night-audit";

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));

export function HistoryPanel() {
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const [history, setHistory] = useState<AuditHistory | null>(null);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const canCorrect = (() => {
    const user = getCurrentUser();
    return Boolean(user?.permissions.includes("night_audit.close") && (user.roleName === "Owner" || user.roleName === "Manager"));
  })();
  const financialRows = [
    ["Nilai kamar", "roomRevenue"],
    ["Pembayaran diterima", "paymentsReceived"],
    ["Refund dibayar", "refundsPaid"],
  ] as const;
  const pending = detail && Object.values(detail.financialReconciliation.pendingDelta).some((value) => value !== 0);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void getAuditHistory(page, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setHistory(result);
        })
        .catch((cause) => {
          if (!controller.signal.aborted)
            setError(
              cause instanceof Error ? cause.message : "Riwayat gagal dimuat.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });
    return () => controller.abort();
  }, [page, retryKey]);

  async function openDetail(businessDate: string) {
    setError("");
    setDetailLoading(true);
    try {
      setDetail(await getAuditDetail(businessDate));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Snapshot gagal dimuat.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function confirmCorrection() {
    if (!detail || saving || reason.trim().length < 3) return;
    setSaving(true);
    setError("");
    try {
      await confirmAuditCorrection(detail.businessDate, reason.trim(), detail.financialReconciliation.previewToken);
      setReason("");
      await openDetail(detail.businessDate);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Koreksi gagal dicatat.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="night-audit-history">
      <div className="night-audit-history-heading">
        <h2>Riwayat Audit</h2>
        {detail && (
          <button
            type="button"
            className="night-audit-secondary"
            onClick={() => setDetail(null)}
          >
            Kembali ke daftar
          </button>
        )}
      </div>
      {error && (
        <div className="night-audit-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="night-audit-secondary"
            onClick={() => {
              setError("");
              setLoading(true);
              setRetryKey((value) => value + 1);
            }}
          >
            Coba lagi
          </button>
        </div>
      )}
      {detailLoading && <p role="status">Memuat snapshot...</p>}
      {detail ? (
        <div className="night-audit-history-detail">
          <p>
            <strong>Tanggal:</strong> {detail.businessDate}
          </p>
          <p>
            <strong>Ditutup:</strong> {dateTime(detail.closedAt)} WIB
          </p>
          <p>
            <strong>Manager:</strong> {detail.closedBy}
          </p>
          <div className="night-audit-summary">
            <div>
              <span>Arrival</span>
              <strong>{detail.snapshot.summary.arrivals}</strong>
            </div>
            <div>
              <span>Departure</span>
              <strong>{detail.snapshot.summary.departures}</strong>
            </div>
            <div>
              <span>In-house</span>
              <strong>{detail.snapshot.summary.inHouse}</strong>
            </div>
            <div>
              <span>Room nights terjual</span>
              <strong>{detail.snapshot.summary.soldRoomNights}</strong>
            </div>
            <div>
              <span>Nilai kamar</span>
              <strong>{money(detail.snapshot.summary.roomRevenue)}</strong>
            </div>
            <div>
              <span>Pembayaran diterima</span>
              <strong>{money(detail.snapshot.summary.paymentsReceived)}</strong>
            </div>
            <div>
              <span>Refund dibayar</span>
              <strong>{money(detail.snapshot.summary.refundsPaid)}</strong>
            </div>
          </div>
          <div className="night-audit-issues">
            <section>
              <h3>Blocker saat ditutup</h3>
              {detail.snapshot.blockers.length ? (
                <ul>
                  {detail.snapshot.blockers.map((issue) => (
                    <li key={issue.code}>
                      {issue.label}: {issue.count}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Tidak ada.</p>
              )}
            </section>
            <section>
              <h3>Warning saat ditutup</h3>
              {detail.snapshot.warnings.length ? (
                <ul>
                  {detail.snapshot.warnings.map((issue) => (
                    <li key={issue.code}>
                      {issue.label}: {issue.count}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Tidak ada.</p>
              )}
            </section>
          </div>
          {detail.snapshot.warningReason && (
            <p>
              <strong>Alasan warning:</strong> {detail.snapshot.warningReason}
            </p>
          )}
          <section className="night-audit-reconciliation" aria-label="Rekonsiliasi keuangan">
            <h3>Rekonsiliasi keuangan</h3>
            <p>Snapshot penutupan tetap utuh. Selisih berikut dihitung dari data transaksi saat ini.</p>
            <div className="night-audit-table-wrap">
              <table>
                <thead><tr><th>Komponen</th><th>Saat ditutup</th><th>Disetujui</th><th>Data kini</th><th>Belum dikonfirmasi</th></tr></thead>
                <tbody>
                  {financialRows.map(([label, key]) => (
                    <tr key={key}>
                      <th scope="row">{label}</th>
                      <td>{money(detail.financialReconciliation.original[key])}</td>
                      <td>{money(detail.financialReconciliation.accepted[key])}</td>
                      <td>{money(detail.financialReconciliation.actual[key])}</td>
                      <td>{money(detail.financialReconciliation.pendingDelta[key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pending && canCorrect && (
              <div className="night-audit-correction-form">
                <label htmlFor="night-audit-correction-reason">Alasan koreksi</label>
                <textarea id="night-audit-correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} />
                <button type="button" className="night-audit-primary" disabled={saving || reason.trim().length < 3} onClick={() => void confirmCorrection()}>
                  {saving ? "Mencatat..." : "Konfirmasi selisih"}
                </button>
              </div>
            )}
            {pending && !canCorrect && <p>Selisih hanya dapat dikonfirmasi oleh Owner atau Manager.</p>}
            {!pending && <p>Tidak ada selisih yang menunggu konfirmasi.</p>}
          </section>
          <section className="night-audit-correction-history">
            <h3>Jejak koreksi</h3>
            {detail.corrections.length ? (
              <ol>
                {detail.corrections.map((entry) => (
                  <li key={entry.id}>
                    <strong>{dateTime(entry.createdAt)} WIB · {entry.actorName}</strong>
                    <p>{entry.reason}</p>
                    <span>Nilai kamar {money(entry.delta.roomRevenue)} · Pembayaran {money(entry.delta.paymentsReceived)} · Refund {money(entry.delta.refundsPaid)}</span>
                  </li>
                ))}
              </ol>
            ) : <p>Belum ada koreksi.</p>}
          </section>
          <p className="night-audit-readonly">
            Snapshot asli tidak dapat diubah; konfirmasi selisih dicatat terpisah.
          </p>
        </div>
      ) : (
        <>
          {loading ? (
            <p role="status">Memuat riwayat audit...</p>
          ) : history?.items.length ? (
            <div className="night-audit-history-list">
              {history.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openDetail(item.businessDate)}
                >
                  <strong>{item.businessDate}</strong>
                  <span>{item.closedBy}</span>
                  <span>{dateTime(item.closedAt)} WIB</span>
                </button>
              ))}
            </div>
          ) : (
            <p>
              Belum ada audit yang ditutup. Snapshot akan muncul di sini setelah
              penutupan pertama.
            </p>
          )}
          {history && history.total > history.limit && (
            <nav
              className="night-audit-history-pages"
              aria-label="Halaman riwayat audit"
            >
              <button
                type="button"
                className="night-audit-secondary"
                disabled={page === 1 || loading}
                onClick={() => {
                  setLoading(true);
                  setPage(page - 1);
                }}
              >
                Sebelumnya
              </button>
              <span>
                Halaman {page} dari {Math.ceil(history.total / history.limit)}
              </span>
              <button
                type="button"
                className="night-audit-secondary"
                disabled={page * history.limit >= history.total || loading}
                onClick={() => {
                  setLoading(true);
                  setPage(page + 1);
                }}
              >
                Berikutnya
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
