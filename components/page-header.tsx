import { ReactNode } from "react";
import { TranslatedText } from "@/components/translated-text";

export function PageHeader({ titleKey, title, descriptionKey, description, action }: { titleKey?: string; title?: ReactNode; descriptionKey?: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-ink md:text-3xl">{titleKey ? <TranslatedText k={titleKey} /> : title}</h1>
        {descriptionKey ? <p className="mt-2 max-w-2xl text-sm text-stone-600"><TranslatedText k={descriptionKey} /></p> : null}
        {description ? <p className="mt-2 max-w-2xl text-sm text-stone-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
