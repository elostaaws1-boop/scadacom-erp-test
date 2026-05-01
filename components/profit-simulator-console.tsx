"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { translate } from "@/lib/i18n";
import { useClientLocale } from "@/components/translated-text";

export type ProfitSimulatorState = {
  result?: {
    profit: number;
    marginPercent: number;
    breakEven: number;
    recommendedPricing: number;
    status: string;
    saved: boolean;
  };
  error?: string;
};

type ProjectOption = {
  id: string;
  name: string;
};

type ProfitSimulatorConsoleProps = {
  projects: ProjectOption[];
  run: (state: ProfitSimulatorState, formData: FormData) => Promise<ProfitSimulatorState>;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "MAD" });

export function ProfitSimulatorConsole({ projects, run }: ProfitSimulatorConsoleProps) {
  const [state, action] = useActionState(run, {});
  const locale = useClientLocale();

  return (
    <section className="space-y-5">
      <form action={action} className="grid max-w-4xl gap-3 rounded-lg border border-black/10 bg-white p-5 shadow-sm md:grid-cols-2">
        <select name="projectId" className="rounded-md border border-stone-300 px-3 py-3">
          <option value="">{translate(locale, "pages.bossRoom.runWithoutSaving")}</option>
          {projects.map((project) => (
            <option value={project.id} key={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <input name="name" placeholder={translate(locale, "pages.bossRoom.scenarioName")} className="rounded-md border border-stone-300 px-3 py-3" />
        <input name="revenue" type="number" step="0.01" min="0" placeholder={translate(locale, "pages.bossRoom.revenueMad")} required className="rounded-md border border-stone-300 px-3 py-3" />
        <input name="manualCost" type="number" step="0.01" min="0" placeholder={translate(locale, "pages.bossRoom.manualCostMad")} required className="rounded-md border border-stone-300 px-3 py-3" />
        <ScenarioButton />
      </form>

      {state.error ? <p className="max-w-4xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{translate(locale, state.error)}</p> : null}

      {state.result ? (
        <div className="grid max-w-4xl gap-4 md:grid-cols-4">
          <ResultCard label={translate(locale, "pages.bossRoom.profit")} value={money.format(state.result.profit)} />
          <ResultCard label={translate(locale, "pages.bossRoom.margin")} value={`${state.result.marginPercent.toFixed(2)}%`} />
          <ResultCard label={translate(locale, "pages.bossRoom.breakEven")} value={money.format(state.result.breakEven)} />
          <ResultCard label={translate(locale, "pages.bossRoom.recommendedPrice")} value={money.format(state.result.recommendedPricing)} detail={state.result.saved ? translate(locale, "pages.bossRoom.savedToProject") : translate(locale, "pages.bossRoom.notSaved")} />
        </div>
      ) : null}
    </section>
  );
}

function ResultCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {detail ? <p className="mt-2 text-xs text-stone-500">{detail}</p> : null}
    </section>
  );
}

function ScenarioButton() {
  const { pending } = useFormStatus();
  const locale = useClientLocale();

  return (
    <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-70 md:col-span-2" disabled={pending} type="submit">
      {pending ? translate(locale, "pages.bossRoom.running") : translate(locale, "pages.bossRoom.runSimulator")}
    </button>
  );
}
