import { InviteForm } from "@/components/invite-form";
import { PageHeader } from "@/components/page-header";
import { roleLabels } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const [invites, projects] = await Promise.all([
    prisma.invite.findMany({ include: { projects: { include: { project: true } } }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.project.findMany({ orderBy: { name: "asc" } })
  ]);
  return (
    <>
      <PageHeader title="Settings" description="No public registration. Access is admin-created through one-time expiring invite links." />
      <InviteForm projects={projects} />
      <div className="grid gap-3">
        {invites.map((invite) => <div className="grid gap-2 rounded-lg border border-black/10 bg-white p-4 text-sm shadow-sm md:grid-cols-5" key={invite.id}><strong>{invite.email}</strong><span>{roleLabels[invite.role]}</span><span>{invite.projects.map((link) => link.project.name).join(", ") || "No project scope"}</span><span>Expires {invite.expiresAt.toLocaleString("fr-MA")}</span><span>{invite.usedAt ? "Used" : "Open"}</span></div>)}
      </div>
    </>
  );
}
