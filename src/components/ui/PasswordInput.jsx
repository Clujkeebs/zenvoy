import { useState } from 'react'
import Icon from '../../icons/Icon'

export default function PasswordInput({ value, onChange, placeholder = "••••••••", ...rest }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: "relative" }}>
      <input
        className="inp"
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{ paddingRight: 40 }}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", padding: 4,
          color: "var(--txt3)", display: "flex", alignItems: "center",
        }}
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        <Icon n={show ? "eye" : "eye"} s={15} c="var(--txt3)" />
      </button>
    </div>
  )
}
