import Icon from '../../icons/Icon'

export default function Toast({ msg }) {
  if (!msg) return null
  return <div className="toast fi"><Icon n="check" s={14} c="var(--green)" />{msg}</div>
}
