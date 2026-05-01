import { createProject } from "@/app/actions";
import { PageHeader } from "@/components/page-header";

const clients = ["MAROC_TELECOM", "INWI", "ERICSSON", "NOKIA", "OTHER"];
const workTypes = ["INSTALLATION", "MAINTENANCE", "UPGRADE", "DISMANTLING", "FIBER", "POWER", "CIVIL", "AUDIT"];
const technologies = ["TWO_G", "THREE_G", "FOUR_G", "FIVE_G", "MICROWAVE", "FIBER", "POWER", "HYBRID"];

export default function NewProjectPage() {
  return (
    <>
      <PageHeader title="New Project" description="Project costs are affected only by approved spending and automatic deployment allowances." />
      <form action={createProject} className="grid max-w-5xl gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-sm md:grid-cols-2">
        <input name="name" required placeholder="Project name" className="rounded-md border px-3 py-3" />
        <input name="siteId" required placeholder="Site ID" className="rounded-md border px-3 py-3" />
        <select name="client" className="rounded-md border px-3 py-3">{clients.map((x) => <option key={x}>{x}</option>)}</select>
        <select name="workType" className="rounded-md border px-3 py-3">{workTypes.map((x) => <option key={x}>{x}</option>)}</select>
        <select name="technology" className="rounded-md border px-3 py-3">{technologies.map((x) => <option key={x}>{x}</option>)}</select>
        <input name="region" required placeholder="Region" className="rounded-md border px-3 py-3" />
        <input name="startDate" required type="date" className="rounded-md border px-3 py-3" />
        <input name="endDate" type="date" className="rounded-md border px-3 py-3" />
        <input name="contractValue" required type="number" step="0.01" placeholder="Contract value MAD" className="rounded-md border px-3 py-3" />
        <input name="allocatedBudget" required type="number" step="0.01" placeholder="Allocated budget MAD" className="rounded-md border px-3 py-3" />
        <select name="status" className="rounded-md border px-3 py-3"><option>PLANNED</option><option>ACTIVE</option><option>ON_HOLD</option><option>COMPLETED</option></select>
        <div className="grid grid-cols-2 gap-3">
          <input name="priority" type="number" min="1" max="5" defaultValue="2" className="rounded-md border px-3 py-3" />
          <input name="complexity" type="number" min="1" max="5" defaultValue="2" className="rounded-md border px-3 py-3" />
        </div>
        <button className="rounded-md bg-ink px-4 py-3 font-semibold text-white md:col-span-2">Create project</button>
      </form>
    </>
  );
}
