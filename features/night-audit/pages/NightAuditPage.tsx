"use client";
import "../styles/night-audit.css";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { getCurrentUser, restoreSession } from "../../../lib/auth";
import { HistoryPanel } from "../components/HistoryPanel";
import { SetupPanel } from "../components/SetupPanel";
import {
  closeAudit,
  getAuditPreview,
  getAuditState,
  setupAudit,
  type AuditClose,
  type AuditPreview,
  type AuditState,
} from "../services/night-audit";

const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

export function NightAuditPage() {
  const [tab, setTab] = useState<"active" | "history">("active");
  const [auditState, setAuditState] = useState<AuditState | null>(null);
  const [preview, setPreview] = useState<AuditPreview | null>(null);
  const [warningReason, setWarningReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupBusy, setSetupBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState<AuditClose | null>(null);
  const [canClose, setCanClose] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    setLoading(true);
    setError("");
    setPreview(null);
    setConfirmed(false);
    try {
      if (!(await restoreSession())) {
        setError("Sesi berakhir. Silakan masuk kembali.");
        return;
      }
      const user = getCurrentUser();
      setCanClose(
        Boolean(user?.permissions.includes("night_audit.close")) &&
          (user?.roleName === "Owner" || user?.roleName === "Manager"),
      );
      const state = await getAuditState(signal);
      if (!signal?.aborted) {
        setAuditState(state);
        if (state.initialized && !state.recoveryRequired) {
          setPreview(await getAuditPreview(signal));
        }
      }
    } catch (cause) {
      if (!signal?.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Preview audit gagal dimuat.",
        );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal));
    return () => controller.abort();
  }, [load]);

  async function handleSetup(startDate: string) {
    setSetupBusy(true);
    setError("");
    try {
      await setupAudit(startDate);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Tanggal mulai gagal disimpan.",
      );
    } finally {
      setSetupBusy(false);
    }
  }

  async function handleClose() {
    if (!preview || !confirmed || closing) return;
    setClosing(true);
    setError("");
    try {
      const result = await closeAudit({
        businessDate: preview.businessDate,
        previewToken: preview.previewToken,
        warningReason: warningReason.trim() || undefined,
      });
      await load();
      setClosed(result);
      setConfirmed(false);
      setWarningReason("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Penutupan audit gagal.",
      );
    } finally {
      setClosing(false);
    }
  }

  return (
    <AdminShell title="Night Audit" context="Penutupan tanggal operasional">
      <main className="night-audit-page">
        <header className="night-audit-heading">
          <div>
            <h1>Night Audit</h1>
            <p>Periksa temuan sebelum menutup tanggal operasional hotel.</p>
          </div>
          <button
            type="button"
            className="night-audit-secondary"
            onClick={() => void load()}
            disabled={loading || closing}
          >
            Muat ulang preview
          </button>
        </header>
        <nav className="night-audit-tabs" aria-label="Tampilan night audit">
          <button
            type="button"
            aria-current={tab === "active" ? "page" : undefined}
            onClick={() => setTab("active")}
          >
            Audit aktif
          </button>
          <button
            type="button"
            aria-current={tab === "history" ? "page" : undefined}
            onClick={() => setTab("history")}
          >
            Riwayat Audit
          </button>
        </nav>
        {tab === "history" ? (
          <HistoryPanel />
        ) : (
          <>
            {loading && <p role="status">Memuat preview audit...</p>}
            {error && (
              <p className="night-audit-error" role="alert">
                {error}
              </p>
            )}
            {closed && (
              <section className="night-audit-result" role="status">
                <h2>Audit {closed.businessDate} ditutup</h2>
                <p>
                  Snapshot tersimpan. Business date berikutnya:{" "}
                  <strong>{closed.nextBusinessDate}</strong>.
                </p>
                <button
                  type="button"
                  className="night-audit-secondary"
                  onClick={() => {
                    setClosed(null);
                    void load();
                  }}
                >
                  Lihat hari berikutnya
                </button>
              </section>
            )}
            {!loading && auditState?.recoveryReason === "date_gap" && (
              <p className="night-audit-error" role="alert">
                Riwayat audit dari {auditState.firstClosedDate} sampai{" "}
                {auditState.lastClosedDate}
                memiliki tanggal yang terlewat. Penutupan ditahan agar tanggal
                tidak dilompati. Periksa snapshot di Riwayat Audit sebelum
                pemulihan manual.
              </p>
            )}
            {!loading &&
              auditState?.recoveryReason === "start_date_mismatch" && (
                <p className="night-audit-error" role="alert">
                  Tanggal mulai tersimpan tidak cocok dengan snapshot pertama.
                  Penutupan ditahan; konfigurasi dan riwayat perlu diperiksa
                  manual.
                </p>
              )}
            {!loading &&
              auditState &&
              !auditState.initialized &&
              (auditState.recoveryReason === null ||
                auditState.recoveryReason === "missing_setup") && (
                <SetupPanel
                  canSetup={canClose}
                  busy={setupBusy}
                  onSetup={handleSetup}
                  existingFirstDate={auditState.firstClosedDate}
                  existingCount={auditState.closedCount}
                />
              )}
            {!loading && preview && (
              <>
                <section
                  className="night-audit-date"
                  aria-label="Tanggal operasional"
                >
                  <div>
                    <span>Business date aktif</span>
                    <strong>{preview.businessDate}</strong>
                    <p>
                      Setelah ditutup, tanggal maju ke{" "}
                      {preview.nextBusinessDate}.
                    </p>
                    {!preview.closeWindowOpen && (
                      <p>
                        Penutupan tersedia setelah 06.00 WIB pada hari
                        berikutnya.
                      </p>
                    )}
                  </div>
                </section>
                <section
                  className="night-audit-summary"
                  aria-label="Ringkasan audit"
                >
                  <div>
                    <span>Arrival</span>
                    <strong>{preview.summary.arrivals}</strong>
                  </div>
                  <div>
                    <span>Departure</span>
                    <strong>{preview.summary.departures}</strong>
                  </div>
                  <div>
                    <span>In-house</span>
                    <strong>{preview.summary.inHouse}</strong>
                  </div>
                  <div>
                    <span>Room nights terjual</span>
                    <strong>{preview.summary.soldRoomNights}</strong>
                  </div>
                  <div>
                    <span>Nilai kamar</span>
                    <strong>{money(preview.summary.roomRevenue)}</strong>
                  </div>
                  <div>
                    <span>Pembayaran diterima</span>
                    <strong>{money(preview.summary.paymentsReceived)}</strong>
                  </div>
                  <div>
                    <span>Refund dibayar</span>
                    <strong>{money(preview.summary.refundsPaid)}</strong>
                  </div>
                </section>
                <div className="night-audit-issues">
                  <section>
                    <h2>Blocker</h2>
                    {preview.blockers.length ? (
                      <ul>
                        {preview.blockers.map((issue) => (
                          <li key={issue.code}>
                            <span>{issue.label}</span>
                            <strong>{issue.count}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>
                        Tidak ada blocker. Tanggal ini dapat ditutup setelah
                        konfirmasi.
                      </p>
                    )}
                  </section>
                  <section>
                    <h2>Warning</h2>
                    {preview.warnings.length ? (
                      <ul>
                        {preview.warnings.map((issue) => (
                          <li key={issue.code}>
                            <span>{issue.label}</span>
                            <strong>{issue.count}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Tidak ada warning yang perlu dicatat.</p>
                    )}
                  </section>
                </div>
                {canClose ? (
                  <section className="night-audit-confirm">
                    <h2>Konfirmasi manager</h2>
                    {preview.warnings.length > 0 && (
                      <label>
                        Alasan melanjutkan dengan warning
                        <textarea
                          value={warningReason}
                          minLength={3}
                          maxLength={1000}
                          onChange={(event) =>
                            setWarningReason(event.target.value)
                          }
                          placeholder="Catat alasan sebelum menutup hari"
                        />
                      </label>
                    )}
                    <label className="night-audit-checkbox">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                      Saya sudah memeriksa preview dan mengonfirmasi penutupan{" "}
                      {preview.businessDate}.
                    </label>
                    <button
                      type="button"
                      className="night-audit-primary"
                      disabled={
                        closing ||
                        !confirmed ||
                        !preview.closeWindowOpen ||
                        preview.blockers.length > 0 ||
                        (preview.warnings.length > 0 &&
                          warningReason.trim().length < 3)
                      }
                      onClick={() => void handleClose()}
                    >
                      {closing
                        ? "Menutup hari..."
                        : `Tutup ${preview.businessDate}`}
                    </button>
                  </section>
                ) : (
                  <p>
                    Hanya Owner atau Manager dengan izin night audit yang dapat
                    menutup hari.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </main>
    </AdminShell>
  );
}
