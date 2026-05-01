"use client";

import { useFormStatus } from "react-dom";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="focus-ring w-full rounded-md bg-ink px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-75" type="submit" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}
