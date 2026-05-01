"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

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

  if (!state.ok) {
    return (
      <section className="max-w-xl rounded-lg border border-black/10 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">Private access</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Enter boss passcode</h2>
          <p className="mt-2 text-sm text-stone-600">This room stays locked even after normal login.</p>
        </div>
        <form action={unlockAction} className="space-y-4">
          <label className="block text-sm font-medium text-ink">
            Passcode
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
          {state.error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.error}</p> : null}
          <UnlockButton />
        </form>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Boss room unlocked for this page.</div>
      <form action={simulate} className="grid max-w-4xl gap-3 rounded-lg border border-black/10 bg-white p-5 shadow-sm md:grid-cols-2">
        <input name="passcode" type="hidden" value={passcode} />
        <select name="projectId" className="rounded-md border border-stone-300 px-3 py-3">
          <option value="">Run without saving</option>
          {projects.map((project) => (
            <option value={project.id} key={project.id}>
              Save to {project.name}
            </option>
          ))}
        </select>
        <input name="name" placeholder="Scenario name" className="rounded-md border border-stone-300 px-3 py-3" />
        <input name="revenue" type="number" step="0.01" min="0" placeholder="Revenue MAD" required className="rounded-md border border-stone-300 px-3 py-3" />
        <input name="manualCost" type="number" step="0.01" min="0" placeholder="Manual cost MAD" required className="rounded-md border border-stone-300 px-3 py-3" />
        <ScenarioButton />
      </form>
    </section>
  );
}

function UnlockButton() {
  const { pending } = useFormStatus();

  return (
    <button className="w-full rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-70" disabled={pending} type="submit">
      {pending ? "Unlocking..." : "Unlock Boss Room"}
    </button>
  );
}

function ScenarioButton() {
  const { pending } = useFormStatus();

  return (
    <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-70 md:col-span-2" disabled={pending} type="submit">
      {pending ? "Running..." : "Run scenario"}
    </button>
  );
}
