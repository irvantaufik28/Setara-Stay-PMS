"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  settleCheckedOutDeposit,
  type DepositReconciliation,
} from "../services/financial-control";

type DepositItem = DepositReconciliation["items"][number];
const money = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

export function DepositSettlementForm({
  deposit,
  canDamage,
  onCancel,
  onSettled,
}: {
  deposit: DepositItem;
  canDamage: boolean;
  onCancel: () => void;
  onSettled: () => void;
}) {
  const [action, setAction] = useState<"refund" | "damage">("refund");
  const [damageAmount, setDamageAmount] = useState("");
  const [reason, setReason] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [refundCompleted, setRefundCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("h2")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
      ) ?? [],
    );
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === dialogRef.current?.querySelector("h2"))
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const parsedDamage = Number(damageAmount);
  const validDamage =
    action === "refund" ||
    (damageAmount.trim() !== "" &&
      Number.isSafeInteger(parsedDamage) &&
      parsedDamage > 0);
  const deducted =
    action === "damage" && validDamage
      ? Math.min(deposit.balance, parsedDamage)
      : 0;
  const refundDue = deposit.balance - deducted;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!reason.trim() || !validDamage) {
      setError("Isi alasan dan nominal kerusakan yang valid.");
      return;
    }
    if (refundDue > 0 && (!refundReference.trim() || !refundCompleted)) {
      setError(
        "Selesaikan refund terlebih dahulu, lalu isi referensi dan konfirmasinya.",
      );
      return;
    }
    setError("");
    setBusy(true);
    try {
      await settleCheckedOutDeposit(deposit.reservationId, deposit.id, {
        action,
        expectedBalance: deposit.balance,
        ...(action === "damage" ? { damageAmount: parsedDamage } : {}),
        reason: reason.trim(),
        ...(refundDue > 0
          ? { refundReference: refundReference.trim(), refundCompleted: true }
          : {}),
      });
      onSettled();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `${cause.message} Jika uang sudah dikirim ke tamu, jangan kirim refund kedua kali.`
          : "Penyelesaian deposit gagal. Periksa saldo terbaru dan coba lagi.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="deposit-settlement-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="deposit-settlement-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deposit-settlement-heading"
        onKeyDown={handleDialogKeyDown}
      >
        <form
          className="deposit-settlement-form"
          onSubmit={(event) => void submit(event)}
        >
          <div className="deposit-settlement-header">
            <div>
              <h2 id="deposit-settlement-heading" tabIndex={-1}>
                Selesaikan deposit {deposit.bookingCode}
              </h2>
              <p>Saldo yang masih dipegang: {money(deposit.balance)}.</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              aria-label="Tutup modal penyelesaian deposit"
            >
              ×
            </button>
          </div>
          <label>
            Tindakan
            <select
              value={action}
              disabled={busy}
              onChange={(event) => {
                setAction(event.target.value as "refund" | "damage");
                setRefundCompleted(false);
                setError("");
              }}
            >
              <option value="refund">Kembalikan seluruh deposit</option>
              {canDamage && (
                <option value="damage">Potong biaya kerusakan</option>
              )}
            </select>
          </label>
          {action === "damage" && (
            <label>
              Total biaya kerusakan
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={damageAmount}
                disabled={busy}
                onChange={(event) => {
                  setDamageAmount(event.target.value);
                  setRefundCompleted(false);
                  setRefundReference("");
                }}
                required
              />
            </label>
          )}
          <label>
            Alasan dan rincian
            <textarea
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={2000}
              required
            />
          </label>
          {validDamage && (
            <p className="deposit-settlement-preview">
              Dipakai untuk kerusakan: {money(deducted)}. Dikembalikan:{" "}
              {money(refundDue)}.
              {action === "damage" && parsedDamage > deducted && (
                <>
                  {" "}
                  Biaya kerusakan yang tidak tertutup deposit:{" "}
                  {money(parsedDamage - deducted)}.
                </>
              )}
            </p>
          )}
          {validDamage && refundDue > 0 && (
            <>
              <p className="deposit-settlement-note">
                Sistem hanya mencatat pengembalian. Lakukan refund ke tamu
                sebelum menyimpan.
              </p>
              <label>
                Referensi refund yang sudah dilakukan
                <input
                  value={refundReference}
                  disabled={busy}
                  onChange={(event) => setRefundReference(event.target.value)}
                  maxLength={160}
                  required
                />
              </label>
              <label className="deposit-settlement-confirm">
                <input
                  type="checkbox"
                  checked={refundCompleted}
                  disabled={busy}
                  onChange={(event) => setRefundCompleted(event.target.checked)}
                />
                Saya mengonfirmasi refund sebesar {money(refundDue)} sudah
                dilakukan.
              </label>
            </>
          )}
          {error && (
            <p
              className="financial-control-state financial-control-error"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="deposit-settlement-actions">
            <button type="button" disabled={busy} onClick={onCancel}>
              Batal
            </button>
            <button type="submit" disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan penyelesaian"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
