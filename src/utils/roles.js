// ─── User Roles ────────────────────────────────────────
// Roles: "user" | "moderator" | "admin"
// Default admin account — change to your real email after domain setup
export const DEFAULT_ADMIN_EMAIL = "admin@zenvoy.com"

export const ROLES = {
  user: { label: "User", icon: null, color: "var(--txt2)" },
  moderator: { label: "Moderator", icon: "shield2", color: "var(--blue)" },
  admin: { label: "Admin", icon: "crown", color: "var(--amber)" },
}

export function getRole(user) {
  return user?.role || "user"
}

export function isAdmin(user) {
  return getRole(user) === "admin"
}

export function isModerator(user) {
  return ["moderator", "admin"].includes(getRole(user))
}

export function canModerate(user) {
  return isModerator(user)
}

export function getRoleBadge(user) {
  const role = getRole(user)
  return ROLES[role] || ROLES.user
}

// Returns role for a new signup based on email
export function getDefaultRole(email) {
  if (email === DEFAULT_ADMIN_EMAIL) return "admin"
  return "user"
}
