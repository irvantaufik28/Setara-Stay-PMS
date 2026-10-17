"use client";
import "../styles/financial-control.css";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import {
  getDepositMovements,
  getDepositReconciliation,
  type DepositMovements,
  type DepositReconciliation,
} from "../services/financial-control";

const limit = 20;
const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
const movementName: Record<string, string> = {
  "deposit.held": "Diterima",
  "deposit.deferred": "Ditunda / sebagian diselesaikan",
  "deposit.settled": "Diselesaikan",
};

export function DepositReconciliationPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"open" | "all">("open");
  const [ledgerStatus, setLedgerStatus] = useState<
    "all" | "matched" | "review"
  >("all");
  const [page, setPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [report, setReport] = useState<DepositReconciliation | null>(null);
  const [movements, setMovements] = useState<DepositMovements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        setError("");
        try {
          if (!(await restoreSession()))
            throw new Error(
              "Sesi berakhir. Masuk kembali untuk melihat laporan.",
            );
          const query = new URLSearchParams({
            view,
            ledgerStatus,
            page: String(page),
            limit: String(limit),
          });
          const movementQuery = new URLSearchParams({
            page: String(movementPage),
            limit: String(limit),
          });
          if (search.trim()) {
            query.set("search", search.trim());
            movementQuery.set("search", search.trim());
          }
          const [nextReport, nextMovements] = await Promise.all([
            getDepositReconciliation(query, controller.signal),
            getDepositMovements(movementQuery, controller.signal),
          ]);
          if (!controller.signal.aborted) {
            setReport(nextReport);
            setMovements(nextMovements);
          }
        } catch (cause) {
          if (!controller.signal.aborted) {
            setReport(null);
            setMovements(null);
            setError(
              cause instanceof Error
                ? cause.message
                : "Laporan deposit gagal dimuat.",
            );
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      search ? 300 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, view, ledgerStatus, page, movementPage]);

  return (
    <AdminShell
      title="Rekonsiliasi Deposit"
      context="Saldo dan mutasi deposit jaminan"
    >
      <main className="financial-control">
        <header className="financial-control-heading">
          <div>
            <h1>Rekonsiliasi Deposit</h1>
            <p>
              Saldo yang masih dipegang hotel dan kecocokannya dengan riwayat
              event deposit.
            </p>
          </div>
          {report && <span>Posisi {timestamp(report.capturedAt)} WIB</span>}
        </header>
        <p className="financial-control-note">
          Laporan ini menunjukkan posisi saat dibaca, bukan saldo historis.
          “Sesuai” berarti angka deposit cocok dengan event aplikasi; ini belum
          mencocokkan mutasi bank atau kas fisik. Deposit terpisah dari tagihan
          reservasi. Deposit yang digunakan untuk tagihan dapat muncul sebagai
          pembayaran di laporan lain; itu bukan uang baru diterima.
        </p>
        <div className="financial-control-filters">
          <label>
            Cari reservasi atau tamu
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
                setMovementPage(1);
              }}
              placeholder="Kode booking atau nama tamu"
            />
          </label>
          <label>
            Tampilkan
            <select
              value={view}
              onChange={(event) => {
                setView(event.target.value as "open" | "all");
                setPage(1);
              }}
            >
              <option value="open">Masih ada saldo</option>
              <option value="all">Semua deposit</option>
            </select>
          </label>
          <label>
            Status jejak deposit
            <select
              value={ledgerStatus}
              onChange={(event) => {
                const next = event.target.value as "all" | "matched" | "review";
                setLedgerStatus(next);
                if (next === "review") setView("all");
                setPage(1);
              }}
            >
              <option value="all">Semua status</option>
              <option value="matched">Sesuai</option>
              <option value="review">Perlu ditinjau</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setView("open");
              setLedgerStatus("all");
              setPage(1);
              setMovementPage(1);
            }}
          >
            Reset filter
          </button>
        </div>
        <p className="financial-control-filter-hint">
          Filter saldo dan status jejak berlaku untuk tabel saldo per deposit.
          Ringkasan dan mutasi tetap mengikuti pencarian reservasi atau tamu.
        </p>
        {loading && (
          <p className="financial-control-state" role="status">
            Memuat posisi deposit...
          </p>
        )}
        {error && (
          <p
            className="financial-control-state financial-control-error"
            role="alert"
          >
            {error} Coba lagi atau periksa sesi Anda.
          </p>
        )}
        {!loading && report && movements && (
          <>
            <div className="financial-control-metrics">
              <div>
                <span>Saldo deposit</span>
                <strong>{money(report.summary.balance)}</strong>
                <small>Masih dipegang hotel</small>
              </div>
              <div>
                <span>Total diterima</span>
                <strong>{money(report.summary.held)}</strong>
                <small>Seluruh deposit tercatat</small>
              </div>
              <div>
                <span>Dikembalikan</span>
                <strong>{money(report.summary.refunded)}</strong>
                <small>Pengembalian deposit</small>
              </div>
              <div>
                <span>Digunakan</span>
                <strong>{money(report.summary.deducted)}</strong>
                <small>Diterapkan ke tagihan atau kerusakan</small>
              </div>
              <div>
                <span>Perlu ditinjau</span>
                <strong>
                  {report.summary.unmatched.toLocaleString("id-ID")}
                </strong>
                <small>Deposit tidak cocok dengan event</small>
              </div>
            </div>
            <section
              className="financial-control-section"
              aria-labelledby="deposit-balances-heading"
            >
              <div className="financial-control-section-heading">
                <h2 id="deposit-balances-heading">Saldo per deposit</h2>
                <span>
                  {report.total.toLocaleString("id-ID")} deposit sesuai filter
                </span>
              </div>
              {report.summary.unmatched > 0 && (
                <p className="financial-control-warning">
                  Ada {report.summary.unmatched} deposit yang tidak cocok dengan
                  riwayat event.{" "}
                  {ledgerStatus === "review"
                    ? "Periksa baris bertanda ‘Tinjau’ sebelum memakai angka ini untuk rekonsiliasi resmi."
                    : "Pilih status ‘Perlu ditinjau’ untuk melihat seluruhnya, termasuk deposit dengan saldo nol."}
                </p>
              )}
              {report.items.length ? (
                <div className="financial-control-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Reservasi</th>
                        <th scope="col">Tamu</th>
                        <th scope="col">Metode</th>
                        <th scope="col">Diterima</th>
                        <th scope="col">Dikembalikan</th>
                        <th scope="col">Digunakan</th>
                        <th scope="col">Saldo</th>
                        <th scope="col">Jejak</th>
                        <th scope="col">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.items.map((item) => (
                        <tr key={item.id}>
                          <th scope="row">
                            <Link href={`/payments/${item.reservationId}`}>
                              {item.bookingCode}
                            </Link>
                          </th>
                          <td>{item.guestName}</td>
                          <td>{item.methodName ?? "Tidak tercatat"}</td>
                          <td>{money(item.held)}</td>
                          <td>{money(item.refunded)}</td>
                          <td>{money(item.deducted)}</td>
                          <td>{money(item.balance)}</td>
                          <td>{item.ledgerMatched ? "Sesuai" : "Tinjau"}</td>
                          <td>
                            <Link
                              href={`/payments/${item.reservationId}`}
                              className="financial-control-detail-link"
                              aria-label={`Lihat detail pembayaran ${item.bookingCode}`}
                            >
                              Lihat Detail
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="financial-control-state">
                  {ledgerStatus === "review"
                    ? "Tidak ada deposit yang perlu ditinjau untuk pencarian ini."
                    : "Tidak ada deposit untuk filter ini. Pilih ‘Semua deposit’ atau ubah pencarian."}
                </p>
              )}
              {report.total > limit && (
                <div className="financial-control-pagination">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Sebelumnya
                  </button>
                  <span>
                    Halaman {page} dari {Math.ceil(report.total / limit)}
                  </span>
                  <button
                    type="button"
                    disabled={page * limit >= report.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </section>
            <section
              className="financial-control-section"
              aria-labelledby="deposit-movements-heading"
            >
              <div className="financial-control-section-heading">
                <h2 id="deposit-movements-heading">Mutasi deposit</h2>
                <span>
                  {movements.total.toLocaleString("id-ID")} event tercatat
                </span>
              </div>
              {movements.items.length ? (
                <div className="financial-control-table-scroll">
                  <table className="financial-control-movement-table">
                    <thead>
                      <tr>
                        <th scope="col">Waktu</th>
                        <th scope="col">Reservasi</th>
                        <th scope="col">Jenis</th>
                        <th scope="col">Diterima</th>
                        <th scope="col">Dikembalikan</th>
                        <th scope="col">Digunakan</th>
                        <th scope="col">Alasan / referensi</th>
                        <th scope="col">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.items.map((item) => (
                        <tr key={item.id}>
                          <td>{timestamp(item.occurredAt)} WIB</td>
                          <th scope="row">
                            <Link href={`/payments/${item.reservationId}`}>
                              {item.bookingCode}
                            </Link>
                          </th>
                          <td>
                            {movementName[item.eventType] ?? item.eventType}
                          </td>
                          <td>{item.held ? money(item.held) : "—"}</td>
                          <td>{item.refunded ? money(item.refunded) : "—"}</td>
                          <td>{item.deducted ? money(item.deducted) : "—"}</td>
                          <td>
                            {[
                              item.deductionPurpose === "balance"
                                ? "Untuk tagihan"
                                : item.deductionPurpose === "damage"
                                  ? "Untuk kerusakan"
                                  : null,
                              item.damageAmount > 0
                                ? `Biaya kerusakan ${money(item.damageAmount)}`
                                : null,
                              item.damageAmount > item.deducted
                                ? `Sisa tagihan ${money(item.damageAmount - item.deducted)}`
                                : null,
                              item.reason,
                              item.reference,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </td>
                          <td>
                            <Link
                              href={`/payments/${item.reservationId}`}
                              className="financial-control-detail-link"
                              aria-label={`Lihat detail pembayaran ${item.bookingCode}`}
                            >
                              Lihat Detail
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="financial-control-state">
                  Belum ada event deposit untuk pencarian ini.
                </p>
              )}
              {movements.total > limit && (
                <div className="financial-control-pagination">
                  <button
                    type="button"
                    disabled={movementPage === 1}
                    onClick={() => setMovementPage(movementPage - 1)}
                  >
                    Sebelumnya
                  </button>
                  <span>
                    Halaman {movementPage} dari{" "}
                    {Math.ceil(movements.total / limit)}
                  </span>
                  <button
                    type="button"
                    disabled={movementPage * limit >= movements.total}
                    onClick={() => setMovementPage(movementPage + 1)}
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </AdminShell>
  );
}
