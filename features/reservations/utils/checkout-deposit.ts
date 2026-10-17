import type { ApiReservationDetail } from "../services/api";

export type CheckoutDepositMode = "refund" | "deduct_balance" | "deduct_damage";
export type CheckoutDepositDecision = {
  depositId: string;
  refundAmount?: number;
  deductionAmount?: number;
  damageAmount?: number;
  deductionPurpose?: "balance" | "damage";
  reason?: string;
  refundReference?: string;
};

export function planCheckoutDeposits(input: {
  deposits: ApiReservationDetail["deposits"];
  modes: Record<string, CheckoutDepositMode | "">;
  damageAmounts: Record<string, string>;
  damageReasons: Record<string, string>;
  refundReferences: Record<string, string>;
  bookingBalance: number;
  canRefund: boolean;
}) {
  let remainingBalance = input.bookingBalance;
  let valid = true;
  const details: Record<
    string,
    { applied: number; refund: number; damageOutstanding: number }
  > = {};
  const decisions: CheckoutDepositDecision[] = [];

  for (const deposit of input.deposits) {
    const available =
      deposit.amountHeld - deposit.amountRefunded - deposit.amountDeducted;
    if (available <= 0) continue;
    const mode = input.modes[deposit.id] ?? "";
    const refundReference = input.refundReferences[deposit.id]?.trim();
    let applied = 0;
    let refund = 0;
    let damageOutstanding = 0;
    let decision: CheckoutDepositDecision = { depositId: deposit.id };

    if (mode === "refund") {
      refund = available;
      decision = {
        depositId: deposit.id,
        refundAmount: refund,
        refundReference,
        reason: "Deposit dikembalikan saat checkout",
      };
    } else if (mode === "deduct_balance") {
      applied = Math.min(available, remainingBalance);
      refund = available - applied;
      remainingBalance -= applied;
      decision = {
        depositId: deposit.id,
        deductionAmount: applied,
        deductionPurpose: "balance",
        refundAmount: refund,
        refundReference: refund > 0 ? refundReference : undefined,
        reason: "Deposit digunakan untuk sisa tagihan saat checkout",
      };
      if (applied === 0) valid = false;
    } else if (mode === "deduct_damage") {
      const rawAmount = input.damageAmounts[deposit.id]?.trim() ?? "";
      const damageAmount = Number(rawAmount);
      const reason = input.damageReasons[deposit.id]?.trim() ?? "";
      if (
        !rawAmount ||
        !Number.isSafeInteger(damageAmount) ||
        damageAmount <= 0 ||
        !reason
      ) {
        valid = false;
      } else {
        applied = Math.min(available, damageAmount);
        refund = available - applied;
        damageOutstanding = damageAmount - applied;
        remainingBalance += damageOutstanding;
        decision = {
          depositId: deposit.id,
          damageAmount,
          deductionAmount: applied,
          deductionPurpose: "damage",
          refundAmount: refund,
          refundReference: refund > 0 ? refundReference : undefined,
          reason,
        };
      }
    } else {
      valid = false;
    }

    if (refund > 0 && (!input.canRefund || !refundReference)) valid = false;
    details[deposit.id] = { applied, refund, damageOutstanding };
    decisions.push(decision);
  }

  return { decisions, details, remainingBalance, valid };
}
