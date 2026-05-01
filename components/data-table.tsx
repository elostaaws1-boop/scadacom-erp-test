import { ReactNode } from "react";

export function DataTable({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-black/10 bg-white shadow-sm">{children}</div>;
}
