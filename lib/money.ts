import { Decimal } from "@prisma/client/runtime/library";

export function mad(value: Decimal | number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2
  }).format(numeric);
}

export function toNumber(value: Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}
