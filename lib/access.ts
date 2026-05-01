import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasGlobalProjectAccess } from "@/lib/rbac";

export async function projectScopeWhere(user: { id: string; role: Role }) {
  if (hasGlobalProjectAccess(user.role)) return {};
  if (user.role === "PROJECT_MANAGER") {
    return { assignments: { some: { userId: user.id } } };
  }
  return { id: "__none__" };
}

export async function projectIdsForUser(user: { id: string; role: Role }) {
  if (hasGlobalProjectAccess(user.role)) return undefined;
  if (user.role === "PROJECT_MANAGER") {
    const assignments = await prisma.projectAssignment.findMany({ where: { userId: user.id }, select: { projectId: true } });
    return assignments.map((assignment) => assignment.projectId);
  }
  return [];
}

export async function canAccessProject(user: { id: string; role: Role }, projectId: string) {
  if (hasGlobalProjectAccess(user.role)) return true;
  if (user.role !== "PROJECT_MANAGER") return false;
  const count = await prisma.projectAssignment.count({ where: { userId: user.id, projectId } });
  return count > 0;
}
