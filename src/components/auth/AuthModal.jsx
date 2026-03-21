import Auth from './Auth'
import Icon from '../../icons/Icon'
const I = Icon

export default function AuthModal({ mode, onAuth, onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(12px)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ position:"relative" }}>
        <button style={{ position:"absolute",top:-12,right:-12,width:28,height:28,borderRadius:"50%",background:"var(--s3)",border:"1.5px solid var(--brd2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:1 }}
          onClick={onClose}><I n="x" s={13} c="var(--txt2)"/></button>
        <Auth onAuth={onAuth} initialMode={mode}/>
      </div>
    </div>
  );
}

