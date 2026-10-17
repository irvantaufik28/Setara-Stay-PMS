import { useState } from "react";

const today = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export function SetupPanel({
  canSetup,
  busy,
  onSetup,
  existingFirstDate,
  existingCount = 0,
}: {
  canSetup: boolean;
  busy: boolean;
  onSetup: (startDate: string) => Promise<void>;
  existingFirstDate?: string | null;
  existingCount?: number;
}) {
  const [startDate, setStartDate] = useState(existingFirstDate ?? "");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <section className="night-audit-confirm">
      <h2>Tetapkan tanggal audit pertama</h2>
      {existingFirstDate ? (
        <p>
          Ditemukan {existingCount} snapshot lama yang berurutan mulai{" "}
          {existingFirstDate}. Tanggal mulai harus sama dengan snapshot pertama.
          Pastikan tidak ada tanggal sebelumnya yang masih perlu diaudit sebelum
          menghubungkannya ke alur baru.
        </p>
      ) : (
        <p>
          Pilih tanggal paling awal yang wajib diaudit. Setelah disimpan,
          tanggal ini tidak dapat diganti dari halaman admin dan audit harus
          ditutup berurutan.
        </p>
      )}
      <label>
        Tanggal mulai
        <input
          type="date"
          value={startDate}
          max={today()}
          disabled={!canSetup || busy || Boolean(existingFirstDate)}
          onChange={(event) => {
            setStartDate(event.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      {canSetup ? (
        <>
          <label className="night-audit-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Saya sudah memastikan tidak ada tanggal sebelumnya yang perlu
            diaudit.
          </label>
          <button
            type="button"
            className="night-audit-primary"
            disabled={!startDate || !confirmed || busy}
            onClick={() => void onSetup(startDate)}
          >
            {busy ? "Menyimpan..." : "Simpan tanggal mulai"}
          </button>
        </>
      ) : (
        <p>
          Hanya Owner atau Manager dengan izin night audit yang dapat melakukan
          setup.
        </p>
      )}
    </section>
  );
}
