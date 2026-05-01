import { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-ink md:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-stone-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
