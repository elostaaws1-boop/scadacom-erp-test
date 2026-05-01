"use client";

import { useFormStatus } from "react-dom";
import { useTranslation } from "@/components/translated-text";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useTranslation();

  return (
    <button className="focus-ring w-full rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-75" type="submit" disabled={pending}>
      {pending ? t("common.actions.signingIn") : t("common.actions.signIn")}
    </button>
  );
}
