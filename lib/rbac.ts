import type { Role } from "@prisma/client";

export const roleLabels: Record<Role, string> = {
  BOSS: "roles.boss",
  GENERAL_MANAGER: "roles.generalManager",
  FINANCIAL_DEPARTMENT: "roles.financialDepartment",
  SUPER_ADMIN: "roles.superAdmin",
  ADMIN: "roles.admin",
  ACCOUNTANT: "roles.accountant",
  PROJECT_MANAGER: "roles.projectManager",
  TEAM_LEADER: "roles.teamLeader",
  TECHNICIAN: "roles.technician",
  WAREHOUSE_MANAGER: "roles.warehouseManager",
  FLEET_MANAGER: "roles.fleetManager"
};

export const bossRoles: Role[] = ["BOSS", "SUPER_ADMIN"];
export const operationalAdminRoles: Role[] = ["BOSS", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"];
export const financeRoles: Role[] = ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"];
export const projectControlRoles: Role[] = ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN"];

export const navigation = [
  { href: "/dashboard", labelKey: "nav.dashboard", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "FINANCIAL_DEPARTMENT", "TEAM_LEADER", "TECHNICIAN", "WAREHOUSE_MANAGER", "FLEET_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/projects", labelKey: "nav.projects", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN"] },
  { href: "/missions", labelKey: "nav.missions", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "TEAM_LEADER", "TECHNICIAN", "SUPER_ADMIN", "ADMIN"] },
  { href: "/teams", labelKey: "nav.teams", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN"] },
  { href: "/employees", labelKey: "nav.employees", roles: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/technician", labelKey: "nav.technician", roles: ["BOSS", "GENERAL_MANAGER", "TEAM_LEADER", "TECHNICIAN", "SUPER_ADMIN"] },
  { href: "/advances", labelKey: "nav.advances", roles: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/purchases", labelKey: "nav.purchases", roles: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/expenses", labelKey: "nav.expenses", roles: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/allowances", labelKey: "nav.allowances", roles: ["BOSS", "GENERAL_MANAGER", "FINANCIAL_DEPARTMENT", "PROJECT_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/profit-simulator", labelKey: "nav.profitSimulator", roles: projectControlRoles },
  { href: "/cash", labelKey: "nav.cash", roles: financeRoles },
  { href: "/suppliers", labelKey: "nav.suppliers", roles: financeRoles },
  { href: "/taxes", labelKey: "nav.taxes", roles: financeRoles },
  { href: "/warehouse", labelKey: "nav.warehouse", roles: ["BOSS", "GENERAL_MANAGER", "WAREHOUSE_MANAGER", "SUPER_ADMIN", "ADMIN"] },
  { href: "/fleet", labelKey: "nav.fleet", roles: ["BOSS", "GENERAL_MANAGER", "FLEET_MANAGER", "SUPER_ADMIN", "ADMIN"] },
  { href: "/imports", labelKey: "nav.imports", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "FINANCIAL_DEPARTMENT", "FLEET_MANAGER", "WAREHOUSE_MANAGER", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/reports", labelKey: "nav.reports", roles: ["BOSS", "GENERAL_MANAGER", "PROJECT_MANAGER", "FINANCIAL_DEPARTMENT", "SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { href: "/boss-room", labelKey: "nav.bossRoom", roles: ["BOSS"] },
  { href: "/settings", labelKey: "nav.settings", roles: ["BOSS", "GENERAL_MANAGER", "SUPER_ADMIN", "ADMIN"] }
] satisfies Array<{ href: string; labelKey: string; roles: Role[] }>;

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

export function isBossIdentity(role: Role, _email?: string | null) {
  return role === "BOSS";
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
