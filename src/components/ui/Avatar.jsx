import { memo } from 'react'
import * as DB from '../../utils/db'

const Avatar = memo(function Avatar({ user, email, name, size = 28, style = {} }) {
  const displayName = name || user?.name || "?"
  const displayEmail = email || user?.email
  const imgUrl = user?.profileImageUrl || (displayEmail ? DB.getProfileImage(displayEmail) : null)
  const initial = displayName.charAt(0).toUpperCase()
  const planBg = user?.plan === "pro" || user?.plan === "scale" ? "var(--lime)" : "var(--s3)"
  const planColor = user?.plan === "pro" || user?.plan === "scale" ? "#0c0e13" : "var(--txt)"

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: imgUrl ? "var(--s3)" : planBg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.42), fontWeight: 900,
      color: imgUrl ? "transparent" : planColor,
      overflow: "hidden",
      ...style,
    }}>
      {imgUrl ? (
        <img src={imgUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initial
      )}
    </div>
  )
})
Avatar.displayName = "Avatar"

export default Avatar
