"use client";
import "../styles/reports.css";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import {
  getManagerDailyReport,
  type ManagerDailyReport,
} from "../services/manager-daily";

function todayJakarta() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const money = (value: number) =>
  `Rp${Math.round(value).toLocaleString("id-ID")}`;
const integer = (value: number) => value.toLocaleString("id-ID");
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
const reservationStatus: Record<string, string> = {
  pending: "Menunggu konfirmasi",
  confirmed: "Terkonfirmasi",
  checked_in: "Check-in",
  checked_out: "Check-out",
};

export function ManagerDailyPage() {
  const [date, setDate] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [report, setReport] = useState<ManagerDailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const initialDate = todayJakarta();
    queueMicrotask(() => {
      setDate(initialDate);
      setSelectedDate(initialDate);
    });
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError("");
      void (async () => {
        try {
          if (!(await restoreSession()))
            throw new Error(
              "Sesi berakhir. Masuk kembali untuk melihat laporan.",
            );
          const data = await getManagerDailyReport(
            selectedDate,
            controller.signal,
          );
          if (!controller.signal.aborted) setReport(data);
        } catch (cause) {
          if (!controller.signal.aborted) {
            setReport(null);
            setError(
              cause instanceof Error ? cause.message : "Laporan gagal dimuat.",
            );
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    });
    return () => controller.abort();
  }, [selectedDate, reloadKey]);

  const metrics = report?.metrics;
  const breakdown = report?.breakdown;
  return (
    <AdminShell
      title="Laporan Manajer Harian"
      context="Satu tanggal operasional"
    >
      <main className="manager-daily-page">
        <header className="manager-daily-heading">
          <div>
            <h1>Laporan Manajer Harian</h1>
            <p>
              Kinerja kamar, arus pembayaran, dan kondisi operasional untuk satu
              tanggal.
            </p>
          </div>
          <form
            className="manager-daily-date"
            onSubmit={(event) => {
              event.preventDefault();
              if (selectedDate === date) setReloadKey((value) => value + 1);
              else setSelectedDate(date);
            }}
          >
            <label htmlFor="manager-daily-date">Tanggal operasional</label>
            <div>
              <input
                id="manager-daily-date"
                type="date"
                value={date}
                max={todayJakarta()}
                onChange={(event) => setDate(event.target.value)}
                required
              />
              <button type="submit" disabled={!date || loading}>
                Tampilkan
              </button>
            </div>
          </form>
        </header>

        {loading && (
          <p className="manager-daily-state" role="status">
            Memuat laporan tanggal {selectedDate}...
          </p>
        )}
        {error && (
          <p
            className="manager-daily-state manager-daily-state--error"
            role="alert"
          >
            {error} Pilih tanggal lain atau coba lagi.
          </p>
        )}
        {!loading && !error && report?.status === "legacy_unavailable" && (
          <p className="manager-daily-state">
            Night Audit tanggal {report.businessDate} sudah ditutup sebelum
            metrik laporan harian tersedia. Angka final tidak dapat
            direkonstruksi dari data saat ini.
          </p>
        )}
        {!loading && !error && metrics && report && (
          <>
            <div className="manager-daily-status">
              <strong>
                {report.status === "final"
                  ? "Final · Night Audit ditutup"
                  : "Sementara · belum ditutup"}
              </strong>
              <span>
                {report.status === "final" && report.closedAt
                  ? `Ditutup ${timestamp(report.closedAt)} WIB`
                  : `Dibaca ${timestamp(report.capturedAt!)} WIB`}
              </span>
            </div>
            <section
              className="manager-daily-section"
              aria-labelledby="manager-daily-room"
            >
              <h2 id="manager-daily-room">Kinerja kamar</h2>
              <div className="manager-daily-metrics">
                <div>
                  <span>Occupancy</span>
                  <strong>{metrics.occupancy.toFixed(1)}%</strong>
                  <small>
                    {integer(metrics.soldRoomNights)} dari{" "}
                    {integer(metrics.availableRooms)} kamar tersedia
                  </small>
                </div>
                <div>
                  <span>Kamar terjual</span>
                  <strong>{integer(metrics.soldRoomNights)}</strong>
                  <small>Room nights pada tanggal ini</small>
                </div>
                <div>
                  <span>ADR / ARR</span>
                  <strong>{money(metrics.adr)}</strong>
                  <small>Room revenue ÷ kamar terjual</small>
                </div>
                <div>
                  <span>RevPAR</span>
                  <strong>{money(metrics.revpar)}</strong>
                  <small>Room revenue ÷ kamar tersedia</small>
                </div>
                <div>
                  <span>Room revenue</span>
                  <strong>{money(metrics.roomRevenue)}</strong>
                  <small>Nilai masa inap, bukan uang diterima</small>
                </div>
              </div>
              {breakdown && (
                <div className="manager-daily-detail">
                  <h3>Rincian per tipe kamar</h3>
                  {breakdown.roomTypes.length === 0 ? (
                    <p>
                      Belum ada kamar tersedia atau room night terjual pada
                      tanggal ini.
                    </p>
                  ) : (
                    <div className="manager-daily-table-scroll">
                      <table aria-label="Kinerja kamar per tipe">
                        <thead>
                          <tr>
                            <th scope="col">Tipe kamar</th>
                            <th scope="col">Tersedia</th>
                            <th scope="col">Terjual</th>
                            <th scope="col">Occupancy</th>
                            <th scope="col">Room revenue</th>
                            <th scope="col">ADR</th>
                            <th scope="col">RevPAR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdown.roomTypes.map((row) => (
                            <tr key={row.roomTypeId}>
                              <th scope="row">{row.name}</th>
                              <td>{integer(row.availableRooms)}</td>
                              <td>{integer(row.soldRoomNights)}</td>
                              <td>
                                {row.availableRooms > 0
                                  ? `${row.occupancy.toFixed(1)}%`
                                  : "—"}
                              </td>
                              <td>{money(row.roomRevenue)}</td>
                              <td>{money(row.adr)}</td>
                              <td>
                                {row.availableRooms > 0
                                  ? money(row.revpar)
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
            <section
              className="manager-daily-section"
              aria-labelledby="manager-daily-finance"
            >
              <h2 id="manager-daily-finance">Pembayaran dan piutang</h2>
              <div className="manager-daily-metrics">
                <div>
                  <span>Pembayaran diterima</span>
                  <strong>{money(metrics.paymentsReceived)}</strong>
                  <small>Transaksi berhasil pada tanggal ini</small>
                </div>
                <div>
                  <span>Refund dibayar</span>
                  <strong>{money(metrics.refundsPaid)}</strong>
                  <small>Refund berhasil pada tanggal ini</small>
                </div>
                <div>
                  <span>Bersih diterima</span>
                  <strong>{money(metrics.netPayments)}</strong>
                  <small>Pembayaran dikurangi refund</small>
                </div>
                <div>
                  <span>
                    Piutang saat{" "}
                    {report.status === "final" ? "ditutup" : "dibaca"}
                  </span>
                  <strong>{money(metrics.receivablesAtCapture)}</strong>
                  <small>Saldo terbuka seluruh reservasi aktif</small>
                </div>
              </div>
              {breakdown && (
                <div className="manager-daily-detail-grid">
                  <div className="manager-daily-detail">
                    <h3>Pembayaran per metode</h3>
                    {breakdown.paymentMethods.length === 0 ? (
                      <p>
                        Belum ada pembayaran atau refund berhasil pada tanggal
                        ini.
                      </p>
                    ) : (
                      <div className="manager-daily-table-scroll">
                        <table aria-label="Pembayaran per metode">
                          <thead>
                            <tr>
                              <th scope="col">Metode</th>
                              <th scope="col">Diterima</th>
                              <th scope="col">Refund</th>
                              <th scope="col">Bersih</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakdown.paymentMethods.map((row) => (
                              <tr key={row.methodId}>
                                <th scope="row">{row.name}</th>
                                <td>{money(row.paymentsReceived)}</td>
                                <td>{money(row.refundsPaid)}</td>
                                <td>{money(row.netPayments)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="manager-daily-detail">
                    <div className="manager-daily-detail-heading">
                      <h3>Piutang per status reservasi</h3>
                      <Link href="/payments/outstanding">
                        Lihat saldo terkini
                      </Link>
                    </div>
                    {breakdown.receivablesByStatus.length === 0 ? (
                      <p>
                        Tidak ada saldo terbuka dari reservasi aktif saat
                        laporan diambil.
                      </p>
                    ) : (
                      <div className="manager-daily-table-scroll">
                        <table aria-label="Piutang per status reservasi">
                          <thead>
                            <tr>
                              <th scope="col">Status</th>
                              <th scope="col">Reservasi</th>
                              <th scope="col">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakdown.receivablesByStatus.map((row) => (
                              <tr key={row.status}>
                                <th scope="row">
                                  {reservationStatus[row.status] ?? row.status}
                                </th>
                                <td>{integer(row.reservations)}</td>
                                <td>{money(row.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
            <section
              className="manager-daily-section"
              aria-labelledby="manager-daily-operation"
            >
              <h2 id="manager-daily-operation">Pengecualian operasional</h2>
              <div className="manager-daily-metrics">
                <div>
                  <span>No-show</span>
                  <strong>{integer(metrics.noShows)}</strong>
                  <small>Reservasi kedatangan tanggal ini</small>
                </div>
                <div>
                  <span>
                    Kamar tidak siap saat{" "}
                    {report.status === "final" ? "ditutup" : "dibaca"}
                  </span>
                  <strong>{integer(metrics.roomsNotReadyAtCapture)}</strong>
                  <small>Cleaning, maintenance, atau out of service</small>
                </div>
              </div>
            </section>
            {report.correction && (
              <p className="manager-daily-correction">
                {report.correction.count} koreksi pasca-audit tercatat. Snapshot
                asli tetap: selisih room revenue{" "}
                {money(report.correction.roomRevenueDelta)}, pembayaran{" "}
                {money(report.correction.paymentsReceivedDelta)}, refund{" "}
                {money(report.correction.refundsPaidDelta)}.
              </p>
            )}
            {!breakdown && report.status === "final" && (
              <p className="manager-daily-state">
                Snapshot ini dibuat sebelum rincian laporan tersedia. Total
                final tetap dapat dilihat, tetapi rincian historis tidak
                dihitung ulang.
              </p>
            )}
            <p className="manager-daily-note">
              Angka sementara mengikuti data saat dibaca dan dapat berubah.
              Angka final adalah snapshot saat Night Audit ditutup.
            </p>
          </>
        )}
      </main>
    </AdminShell>
  );
}
