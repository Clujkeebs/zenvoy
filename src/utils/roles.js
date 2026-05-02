// ─── User Roles ────────────────────────────────────────
// Roles: "user" | "moderator" | "admin" | "owner"
export const OWNER_EMAIL = "clujkeebs@aol.com"
export const DEFAULT_ADMIN_EMAIL = OWNER_EMAIL

export const ROLES = {
  user:      { label: "User",      icon: null,      color: "var(--txt2)" },
  moderator: { label: "Moderator", icon: "shield2", color: "var(--blue)" },
  admin:     { label: "Admin",     icon: "shield2", color: "var(--amber)" },
  owner:     { label: "Owner",     icon: "crown",   color: "#FFD700" },
}

export function getRole(user) {
  return user?.role || "user"
}

// Only the one true owner
export function isOwner(user) {
  return getRole(user) === "owner"
}

// Admins + owner both have elevated access
export function isAdmin(user) {
  const r = getRole(user)
  return r === "admin" || r === "owner"
}

export function isModerator(user) {
  return ["moderator", "admin", "owner"].includes(getRole(user))
}

export function canModerate(user) {
  return isModerator(user)
}

export function getRoleBadge(user) {
  const role = getRole(user)
  return ROLES[role] || ROLES.user
}

// New signups default to user; owner email gets owner role
export function getDefaultRole(email) {
  if (email === OWNER_EMAIL) return "owner"
  return "user"
}
