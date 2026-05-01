"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { translate } from "@/lib/i18n";
import { useClientLocale } from "@/components/translated-text";

type ProjectOption = {
  id: string;
  name: string;
};

export type UnlockState = {
  ok: boolean;
  error?: string;
};

type BossRoomConsoleProps = {
  projects: ProjectOption[];
  unlock: (state: UnlockState, formData: FormData) => Promise<UnlockState>;
  simulate: (formData: FormData) => Promise<void>;
};

export function BossRoomConsole({ projects, unlock, simulate }: BossRoomConsoleProps) {
  const [passcode, setPasscode] = useState("");
  const [state, unlockAction] = useActionState(unlock, { ok: false });
  const locale = useClientLocale();

  if (!state.ok) {
    return (
      <section className="max-w-xl rounded-lg border border-black/10 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">{translate(locale, "pages.bossRoom.privateAccess")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{translate(locale, "pages.bossRoom.enterPasscode")}</h2>
          <p className="mt-2 text-sm text-stone-600">{translate(locale, "pages.bossRoom.lockedDescription")}</p>
        </div>
        <form action={unlockAction} className="space-y-4">
          <label className="block text-sm font-medium text-ink">
            {translate(locale, "pages.bossRoom.passcode")}
            <input
              autoFocus
              className="focus-ring mt-2 w-full rounded-md border border-stone-300 px-3 py-3 text-lg"
              name="passcode"
              type="password"
              inputMode="numeric"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              required
            />
          </label>
          {state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{translate(locale, state.error)}</p> : null}
          <UnlockButton />
        </form>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{translate(locale, "pages.bossRoom.unlocked")}</div>
      <form action={simulate} className="grid max-w-4xl gap-3 rounded-lg border border-black/10 bg-white p-5 shadow-sm md:grid-cols-2">
        <input name="passcode" type="hidden" value={passcode} />
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
    </section>
  );
}

function UnlockButton() {
  const { pending } = useFormStatus();
  const locale = useClientLocale();

  return (
    <button className="w-full rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-70" disabled={pending} type="submit">
      {pending ? translate(locale, "pages.bossRoom.unlocking") : translate(locale, "pages.bossRoom.unlock")}
    </button>
  );
}

function ScenarioButton() {
  const { pending } = useFormStatus();
  const locale = useClientLocale();

  return (
    <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-70 md:col-span-2" disabled={pending} type="submit">
      {pending ? translate(locale, "pages.bossRoom.running") : translate(locale, "pages.bossRoom.runScenario")}
    </button>
  );
}
