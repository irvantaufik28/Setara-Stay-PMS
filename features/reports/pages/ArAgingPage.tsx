"use client";
import "../styles/financial-control.css";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { restoreSession } from "../../../lib/auth";
import {
  getArAgingReport,
  type AgingBucket,
  type ArAgingReport,
} from "../services/financial-control";

const limit = 20;
const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const bucketLabels: Record<AgingBucket, string> = {
  "0_30": "0–30 hari",
  "31_60": "31–60 hari",
  "61_90": "61–90 hari",
  over_90: ">90 hari",
};
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));

export function ArAgingPage() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [bucket, setBucket] = useState<AgingBucket | "">("");
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<ArAgingReport | null>(null);
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
            page: String(page),
            limit: String(limit),
          });
          if (search.trim()) query.set("search", search.trim());
          if (source) query.set("source", source);
          if (bucket) query.set("bucket", bucket);
          const next = await getArAgingReport(query, controller.signal);
          if (!controller.signal.aborted) setReport(next);
        } catch (cause) {
          if (!controller.signal.aborted) {
            setReport(null);
            setError(
              cause instanceof Error
                ? cause.message
                : "Laporan umur piutang gagal dimuat.",
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
  }, [search, source, bucket, page]);

  return (
    <AdminShell
      title="Umur Piutang"
      context="Reservasi check-out dengan saldo terbuka"
    >
      <main className="financial-control financial-control--ar-aging">
        <header className="financial-control-heading">
          <div>
            <h1>Umur Piutang</h1>
            <p>
              Saldo reservasi yang sudah check-out, dikelompokkan sejak tanggal
              check-out.
            </p>
          </div>
          {report && <span>Posisi {timestamp(report.capturedAt)} WIB</span>}
        </header>
        <p className="financial-control-note">
          Belum ada tanggal jatuh tempo atau termin kredit khusus. Umur dihitung
          dari tanggal check-out sampai hari ini di zona WIB; ini bukan laporan
          historis per tanggal lampau.
        </p>
        <div className="financial-control-filters">
          <label>
            Cari reservasi atau tamu
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Kode booking, nama, atau telepon"
            />
          </label>
          <label>
            Sumber
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua sumber</option>
              <option value="website">Website</option>
              <option value="walk_in">Walk-in</option>
              <option value="phone">Telepon</option>
              <option value="ota">OTA</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSource("");
              setBucket("");
              setPage(1);
            }}
          >
            Reset filter
          </button>
        </div>
        {loading && (
          <p className="financial-control-state" role="status">
            Memuat posisi piutang...
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
        {!loading && report && (
          <>
            <div className="financial-control-total">
              <span>Total piutang check-out</span>
              <strong>{money(report.summary.totalBalance)}</strong>
              <small>
                {report.summary.totalReservations.toLocaleString("id-ID")}{" "}
                reservasi
              </small>
            </div>
            <div
              className="financial-control-buckets"
              aria-label="Filter umur piutang"
            >
              {report.summary.buckets.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={bucket === item.key}
                  onClick={() => {
                    setBucket(bucket === item.key ? "" : item.key);
                    setPage(1);
                  }}
                >
                  <span>{bucketLabels[item.key]}</span>
                  <strong>{money(item.amount)}</strong>
                  <small>{item.count.toLocaleString("id-ID")} reservasi</small>
                </button>
              ))}
            </div>
            <section
              className="financial-control-section"
              aria-labelledby="aging-detail-heading"
            >
              <div className="financial-control-section-heading">
                <h2 id="aging-detail-heading">Daftar piutang</h2>
                <span>
                  {bucket ? bucketLabels[bucket] : "Semua umur"} ·{" "}
                  {report.total.toLocaleString("id-ID")} reservasi
                </span>
              </div>
              {report.items.length ? (
                <div className="financial-control-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Reservasi</th>
                        <th scope="col">Tamu</th>
                        <th scope="col">Check-out</th>
                        <th scope="col">Umur</th>
                        <th scope="col">Saldo</th>
                        <th scope="col">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.items.map((item) => (
                        <tr key={item.id}>
                          <th scope="row">{item.bookingCode}</th>
                          <td>{item.guestName}</td>
                          <td>
                            {dateLabel(item.checkedOutAt ?? item.checkOutDate)}
                          </td>
                          <td>{item.ageDays} hari</td>
                          <td>{money(item.balance)}</td>
                          <td>
                            <Link
                              href={`/payments/${item.id}`}
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
                  Tidak ada piutang untuk filter ini. Pilih kelompok umur atau
                  sumber lain.
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
          </>
        )}
      </main>
    </AdminShell>
  );
}
