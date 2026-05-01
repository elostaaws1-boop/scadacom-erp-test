"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { importExcelData } from "@/app/actions";

const initialState = { ok: false, imported: 0, skipped: 0, messages: [] as string[] };

export function ExcelImportForm() {
  const [state, formAction, pending] = useActionState(importExcelData, initialState);

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <form action={formAction} encType="multipart/form-data" className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <select name="importType" className="rounded-md border px-3 py-3">
          <option value="projects">Projects</option>
          <option value="employees">Employees</option>
          <option value="vehicles">Fleet vehicles</option>
          <option value="purchases">Work purchases</option>
          <option value="expenses">Expenses</option>
        </select>
        <input name="file" type="file" accept=".xlsx" required className="rounded-md border px-3 py-3" />
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 font-semibold text-white" disabled={pending}>
          <Upload size={17} /> {pending ? "Analyzing..." : "Analyze & import"}
        </button>
      </form>

      {pending ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Reading Excel file and applying ERP rules...
        </div>
      ) : null}

      {state.imported > 0 || state.skipped > 0 || state.messages.length > 0 ? (
        <div className={`mt-5 rounded-md border p-4 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <p className="font-semibold text-ink">
            Import result: {state.imported} row{state.imported === 1 ? "" : "s"} imported, {state.skipped} skipped
          </p>
          {state.messages.length > 0 ? (
            <ul className="mt-3 grid gap-1 text-stone-700">
              {state.messages.map((message) => <li key={message}>{message}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
