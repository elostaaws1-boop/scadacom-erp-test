import { ReactNode } from "react";
import { TranslatedText } from "@/components/translated-text";

export function StatCard({ labelKey, value, detailKey, detail }: { labelKey: string; value: ReactNode; detailKey?: string; detail?: ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <p className="text-sm text-stone-500"><TranslatedText k={labelKey} /></p>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {detailKey ? <p className="mt-2 text-xs text-stone-500"><TranslatedText k={detailKey} /></p> : null}
      {detail ? <p className="mt-2 text-xs text-stone-500">{detail}</p> : null}
    </section>
  );
}
