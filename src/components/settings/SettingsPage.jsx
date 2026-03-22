import PageHeader from '../ui/PageHeader'
import { useState, useRef } from 'react'
import Icon from '../../icons/Icon'
import { PLANS } from '../../constants/plans'
import { SERVICES } from '../../constants/services'
import * as DB from '../../utils/db'
const I = Icon

export default function SettingsPage({ user, onUpdate, onLogout, onGoSubscription, onNav }) {
  const [name,  setName]  = useState(user.name);
  const [svc,   setSvc]   = useState(user.svc||"web");
  const [saved, setSaved] = useState(false);
  const [imgUrl, setImgUrl] = useState(user.profileImageUrl || null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const refLink = `${window.location.origin}${window.location.pathname}?ref=${user.refCode}`;

  const save = () => {
    const u={...user,name,svc}; DB.saveUser(user.email,u); onUpdate(u); setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2MB"); return; }
    setUploading(true);
    try {
      const url = await DB.saveProfileImage(user.email, file);
      if (url) {
        setImgUrl(url);
        const u = { ...user, profileImageUrl: url };
        onUpdate(u);
      }
    } catch (err) {
      alert("Upload failed: " + err.message);
    }
    setUploading(false);
  };

  return (
    <div style={{ maxWidth:700 }}>
      <PageHeader title="Settings" onBack={() => onNav("home")} onHome={() => onNav("home")} />

      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",
        background:"var(--s2)",borderRadius:9,border:"1.5px solid var(--brd)",marginBottom:16 }}>
        <div style={{ fontSize:13,color:"var(--txt2)" }}>
          Current plan: <strong style={{ color:PLANS[user.plan||"free"]?.color||"var(--txt)" }}>
            {PLANS[user.plan||"free"]?.name || "Free"}
          </strong>
        </div>
        <button className="btn btn-lime" style={{ fontSize:12,padding:"7px 14px" }} onClick={onGoSubscription}>
          Manage Subscription →
        </button>
      </div>

      <div className="card" style={{ padding:"19px 22px",marginBottom:12 }}>
        <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14,marginBottom:13,display:"flex",gap:7,alignItems:"center" }}>
          <I n="users" s={15} c="var(--lime)"/>Profile
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:16 }}>
          <div onClick={() => fileRef.current?.click()} style={{
            width:56,height:56,borderRadius:"50%",cursor:"pointer",overflow:"hidden",flexShrink:0,
            background:imgUrl?"var(--s3)":"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center",
            border:"2.5px solid var(--brd)",transition:"border-color .15s",position:"relative",
          }}>
            {imgUrl ? (
              <img src={imgUrl} alt="Profile" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
            ) : (
              <span style={{ fontSize:22,fontWeight:900,color:"var(--txt2)" }}>{user.name?.charAt(0).toUpperCase()}</span>
            )}
            {uploading && <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <div style={{ width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite" }} />
            </div>}
          </div>
          <div>
            <button className="btn btn-ghost" style={{ fontSize:11,padding:"5px 10px" }} onClick={() => fileRef.current?.click()} disabled={uploading}>
              <I n="up" s={12}/>{imgUrl ? "Change Photo" : "Upload Photo"}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display:"none" }} onChange={handleImageUpload} />
            <div style={{ fontSize:10,color:"var(--txt3)",marginTop:3 }}>JPG, PNG, or WebP. Max 2MB.</div>
          </div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:11,marginBottom:13 }}>
          <div><span className="lbl">Name</span><input className="inp" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div><span className="lbl">Email</span><input className="inp" value={user.email} disabled style={{ opacity:.5 }}/></div>
          <div><span className="lbl">Country</span><div className="inp" style={{ opacity:.6,cursor:"not-allowed" }}>{user.country}</div></div>
          <div>
            <span className="lbl">Primary Service</span>
            <select className="inp" value={svc} onChange={e=>setSvc(e.target.value)}>
              {SERVICES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-lime" onClick={save}><I n="check" s={14}/>{saved?"Saved! ✓":"Save Changes"}</button>
      </div>

      <div className="card" style={{ padding:"19px 22px",marginBottom:12 }}>
        <div style={{ display:"flex",alignItems:"center",gap:9,marginBottom:9 }}>
          <I n="gift" s={16} c="var(--lime)"/>
          <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14 }}>Refer a Friend — Earn 10 Free Scans</div>
        </div>
        <p style={{ color:"var(--txt2)",fontSize:13,marginBottom:12 }}>
          When someone signs up using your link you get +10 bonus scans automatically. You've referred <strong style={{ color:"var(--lime)" }}>{user.referrals||0}</strong> {(user.referrals||0)===1?"person":"people"} so far.
        </p>
        <div style={{ display:"flex",gap:8 }}>
          <div className="inp" style={{ flex:1,fontSize:12,color:"var(--txt2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{refLink}</div>
          <button className="btn btn-lime" style={{ whiteSpace:"nowrap" }} onClick={()=>navigator.clipboard.writeText(refLink)}><I n="copy" s={13}/>Copy Link</button>
        </div>
      </div>

      <div className="card" style={{ padding:"19px 22px",border:"1.5px solid rgba(245,66,66,.2)" }}>
        <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14,color:"var(--red)",marginBottom:10,display:"flex",gap:6,alignItems:"center" }}>
          <I n="alert" s={14} c="var(--red)"/>Danger Zone
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn btn-red" onClick={()=>{
            if(window.confirm("Delete ALL your leads and scan history?")) { DB.saveLeads(user.email,[]); DB.saveScans(user.email,[]); window.location.reload(); }
          }}><I n="trash" s={14}/>Clear All Data</button>
          <button className="btn btn-red" onClick={onLogout}><I n="logout" s={14}/>Sign Out</button>
        </div>
      </div>
    </div>
  );
}
