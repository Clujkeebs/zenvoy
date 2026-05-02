import Icon from '../../icons/Icon'
import { getRoleBadge, isOwner } from '../../utils/roles'

export default function RoleBadge({ user, size = 12 }) {
  if (isOwner(user)) {
    return (
      <span title="Owner" style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginLeft: 3,
        filter: "drop-shadow(0 0 4px rgba(255,215,0,0.7))",
      }}>
        <Icon n="crown" s={size + 1} c="#FFD700" />
      </span>
    )
  }

  const badge = getRoleBadge(user)
  if (!badge.icon) return null
  return (
    <span title={badge.label} style={{ display: "inline-flex", alignItems: "center", marginLeft: 3 }}>
      <Icon n={badge.icon} s={size} c={badge.color} />
    </span>
  )
}
