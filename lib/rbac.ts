import type { Role } from "@prisma/client";

export const roleLabels: Record<Role, string> = {
  BOSS: "Boss",
  GENERAL_MANAGER: "General Manager",
  FINANCIAL_DEPARTMENT: "Financial Department",
  SUPER_ADMIN: "Legacy Super Admin",
  ADMIN: "Legacy Admin",
  ACCOUNTANT: "Legacy Accountant",
  PROJECT_MANAGER: "Project Manager",
  TEAM_LEADER: "Team Leader",
  TECHNICIAN: "Technician",
  WAREHOUSE_MANAGER: "Warehouse Manager",
  FLEET_MANAGER: "Fleet Manager"
};

export const bossRoles: Role[] = ["BOSS", "SUPER_ADMIN"];
export const operationalAdminRoles: Role[] = ["BOSS", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"];
export const financeRoles: Role[] = ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"];
export const projectControlRoles: Role[] = ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN"];

export const navigation = [
  { href: "/dashboard", label: "Dashboard", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "FINANCIAL_DEPARTMENT", "TEAM_LEADER", "TECHNICIAN", "WAREHOUSE_MANAGER", "FLEET_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/projects", label: "Projects", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN"] },
  { href: "/missions", label: "Missions", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "TEAM_LEADER", "TECHNICIAN", "SUPER_ADMIN", "ADMIN"] },
  { href: "/teams", label: "Teams", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN"] },
  { href: "/employees", label: "Employees", roles: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/technician", label: "Technician Portal", roles: ["BOSS", "GENERAL_MANAGER", "TEAM_LEADER", "TECHNICIAN", "SUPER_ADMIN"] },
  { href: "/advances", label: "Advance Requests", roles: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/purchases", label: "Work Purchases", roles: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/expenses", label: "Expenses", roles: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/allowances", label: "Deployment Allowances", roles: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/cash", label: "Cash Control", roles: financeRoles },
  { href: "/suppliers", label: "Suppliers", roles: financeRoles },
  { href: "/taxes", label: "Taxes", roles: financeRoles },
  { href: "/warehouse", label: "Warehouse", roles: ["BOSS", "GENERAL_MANAGER", "WAREHOUSE_MANAGER", "SUPER_ADMIN", "ADMIN"] },
  { href: "/fleet", label: "Fleet", roles: ["BOSS", "GENERAL_MANAGER", "FLEET_MANAGER", "SUPER_ADMIN", "ADMIN"] },
  { href: "/imports", label: "Excel Imports", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "FINANCIAL_DEPARTMENT", "FLEET_MANAGER", "WAREHOUSE_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/reports", label: "Reports", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/boss-room", label: "Boss Profit Room", roles: ["BOSS"] },
  { href: "/settings", label: "Settings", roles: ["BOSS", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"] }
] satisfies Array<{ href: string; label: string; roles: Role[] }>;

export function allRoles(): Role[] {
  return [
    "BOSS",
    "GENERAL_MANAGER",
    "FINANCIAL_DEPARTMENT",
    "PROJECT_MANAGER",
    "TEAM_LEADER",
    "TECHNICIAN",
    "WAREHOUSE_MANAGER",
    "FLEET_MANAGER"
  ];
}

export function canAccess(role: Role, allowed: Role[]) {
  return allowed.includes(role);
}

export function isBossIdentity(role: Role, email?: string | null) {
  return role === "BOSS" && !!email && email.toLowerCase() === (process.env.BOSS_EMAIL ?? "boss@telecom.local").toLowerCase();
}

export function visibleNavigationFor(role: Role, email?: string | null) {
  return navigation.filter((item) => item.roles.includes(role) && (item.href !== "/boss-room" || isBossIdentity(role, email)));
}

export function canApprove(role: Role) {
  return ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(role);
}

export function canOverride(role: Role) {
  return role === "BOSS" || role === "SUPER_ADMIN";
}

export function hasGlobalProjectAccess(role: Role) {
  return ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(role);
}
