"use client";

import { useActionState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { uploadExcelCostFile, type ExcelCostAnalyzerState } from "@/app/actions";

const initialState: ExcelCostAnalyzerState = {
  ok: false,
  message: ""
};

export function ExcelCostUploadForm() {
  const [state, formAction, pending] = useActionState(uploadExcelCostFile, initialState);

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink">Upload Excel file</h2>
        <p className="mt-1 text-sm text-stone-600">
          Upload the original workbook. The analyzer stores it for audit and builds a preview before any ERP cost is changed.
        </p>
      </div>
      <form action={formAction} encType="multipart/form-data" className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <input
          name="file"
          type="file"
          accept=".xlsx,.xls"
          required
          className="rounded-md border border-black/10 bg-white px-3 py-3 text-sm"
        />
        <input
          name="notes"
          placeholder="Optional notes, period, or source"
          className="rounded-md border border-black/10 bg-white px-3 py-3 text-sm"
        />
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending}
        >
          {pending ? <Loader2 className="animate-spin" size={17} /> : <FileSpreadsheet size={17} />}
          {pending ? "Analyzing..." : "Upload & analyze"}
        </button>
      </form>

      {state.message ? (
        <div className={`mt-5 rounded-md border p-4 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
          <p className="font-semibold">{state.message}</p>
          {state.ok && state.importId ? (
            <a className="mt-3 inline-flex rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink ring-1 ring-black/10" href={`/excel-cost-analyzer?importId=${state.importId}`}>
              Open analysis
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
