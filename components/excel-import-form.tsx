"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { importExcelData } from "@/app/actions";
import { T, useTranslation } from "@/components/translated-text";

const initialState = { ok: false, imported: 0, skipped: 0, messages: [] as string[] };

export function ExcelImportForm() {
  const [state, formAction, pending] = useActionState(importExcelData, initialState);
  const { t } = useTranslation();

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <form action={formAction} encType="multipart/form-data" className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <select name="importType" className="rounded-md border px-3 py-3">
          <option value="projects">{t("nav.projects")}</option>
          <option value="employees">{t("nav.employees")}</option>
          <option value="vehicles">{t("nav.fleet")}</option>
          <option value="purchases">{t("nav.purchases")}</option>
          <option value="expenses">{t("nav.expenses")}</option>
        </select>
        <input name="file" type="file" accept=".xlsx" required className="rounded-md border px-3 py-3" />
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 font-semibold text-white" disabled={pending}>
          <Upload size={17} /> {pending ? t("common.messages.analyzing") : t("common.actions.analyzeImport")}
        </button>
      </form>

      {pending ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          <T k="pages.imports.reading" />
        </div>
      ) : null}

      {state.imported > 0 || state.skipped > 0 || state.messages.length > 0 ? (
        <div className={`mt-5 rounded-md border p-4 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <p className="font-semibold text-ink">
            <T k="pages.imports.result" />: {state.imported} {t("common.units.rows")} {t("pages.imports.imported")}, {state.skipped} {t("pages.imports.skipped")}
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
