import { ReactNode } from "react";
import { TranslatedText } from "@/components/translated-text";

export function StatCard({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <p className="text-sm text-stone-500"><TranslatedText text={label} /></p>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {detail ? <p className="mt-2 text-xs text-stone-500"><TranslatedText text={detail} /></p> : null}
    </section>
  );
}
