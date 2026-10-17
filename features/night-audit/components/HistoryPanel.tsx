"use client";

import { useEffect, useState } from "react";
import {
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
          <p className="night-audit-readonly">
            Snapshot ini hanya dapat dilihat, tidak dapat diubah.
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
