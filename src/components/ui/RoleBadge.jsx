import Icon from '../../icons/Icon'
import { getRoleBadge } from '../../utils/roles'

export default function RoleBadge({ user, size = 12 }) {
  const badge = getRoleBadge(user)
  if (!badge.icon) return null
  return (
    <span title={badge.label} style={{ display: "inline-flex", alignItems: "center", marginLeft: 3 }}>
      <Icon n={badge.icon} s={size} c={badge.color} />
    </span>
  )
}
