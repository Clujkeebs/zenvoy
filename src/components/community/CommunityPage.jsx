import { useState, useEffect, useRef } from 'react'
import Icon from '../../icons/Icon'
import { SEED_GROUPS } from '../../constants/community'
import { canAI } from '../../constants/plans'
import { timeAgo } from '../../utils/helpers'
import * as DB from '../../utils/db'
const I = Icon

export default function CommunityPage({ user, onGoSettings }) {
  const [posts,       setPosts]       = useState([]);
  const [groups,      setGroups]      = useState([]);
  const [myGroupIds,  setMyGroupIds]  = useState([]);
  const [filter,      setFilter]      = useState("all");
  const [showPost,    setShowPost]    = useState(false);
  const [showCreate,  setShowCreate]  = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [newPost,     setNewPost]     = useState({type:"general",title:"",content:""});
  const [newGroup,    setNewGroup]    = useState({name:"",desc:"",private:false});
  const [groupFeed,   setGroupFeed]   = useState([]);
  const [groupPost,   setGroupPost]   = useState({title:"",content:""});
  const [showGPost,   setShowGPost]   = useState(false);
  const [upgradeFor,  setUpgradeFor]  = useState(null); // {feature, plan}
  const [showMore,       setShowMore]       = useState(false);
  const [commentDraft,   setCommentDraft]   = useState({}); // postId → text
  const [expandComment,  setExpandComment]  = useState({}); // postId → bool

  const canCreateGroup = ["pro","scale"].includes(user.plan);

  const POST_TYPES = [
    {id:"general",    label:"💬 General",     color:"var(--txt2)"},
    {id:"win",        label:"🏆 Win",          color:"var(--green)"},
    {id:"opportunity",label:"💡 Opportunity",  color:"var(--lime)"},
    {id:"question",   label:"❓ Question",     color:"var(--blue)"},
    {id:"tip",        label:"📌 Tip",          color:"var(--amber)"},
  ];

  useEffect(()=>{
    setPosts(DB.posts());
    setGroups(DB.groups());
    setMyGroupIds(DB.myGroups(user.email));
  },[]);

  const filtered = filter==="all" ? posts : posts.filter(p=>p.type===filter);
  const sorted   = [...filtered].sort((a,b)=>b.createdAt-a.createdAt);

  const toggleUpvote = (postId) => {
    const updated = posts.map(p=>{
      if(p.id!==postId) return p;
      const already = p.upvotes.includes(user.email);
      return {...p, upvotes: already ? p.upvotes.filter(u=>u!==user.email) : [...p.upvotes, user.email]};
    });
    setPosts(updated); DB.savePosts(updated);
  };

  const submitPost = () => {
    if(!newPost.title||!newPost.content) return;
    const p = {
      id:"p_"+Date.now(), authorName:user.name, authorEmail:user.email,
      authorPlan:user.plan, type:newPost.type, title:newPost.title,
      content:newPost.content, country:user.country,
      service:user.svc||"web", upvotes:[], comments:[],
      createdAt:Date.now(),
    };
    const updated=[p,...posts]; setPosts(updated); DB.savePosts(updated);
    setNewPost({type:"general",title:"",content:""}); setShowPost(false);
  };

  const submitComment = (postId) => {
    const text = (commentDraft[postId]||'').trim();
    if(!text) return;
    const updated = posts.map(p=>{
      if(p.id!==postId) return p;
      const c = {id:'c_'+Date.now(), author:user.name, authorEmail:user.email, text, createdAt:Date.now()};
      return {...p, comments:[...p.comments, c]};
    });
    setPosts(updated); DB.savePosts(updated);
    setCommentDraft(d=>({...d,[postId]:''}));
  };

  const toggleComments = (postId) => {
    setExpandComment(s=>({...s,[postId]:!s[postId]}));
  };

  const joinGroup = (gid) => {
    const updated=[...myGroupIds, gid]; setMyGroupIds(updated); DB.saveMyGroups(user.email, updated);
  };
  const leaveGroup = (gid) => {
    const updated=myGroupIds.filter(x=>x!==gid); setMyGroupIds(updated); DB.saveMyGroups(user.email, updated);
  };

  const openGroup = (g) => {
    setActiveGroup(g);
    setGroupFeed(DB.groupFeed(g.id));
  };

  const submitGroupPost = () => {
    if(!groupPost.title||!groupPost.content||!activeGroup) return;
    const p={id:"gp_"+Date.now(),authorName:user.name,authorEmail:user.email,authorPlan:user.plan,title:groupPost.title,content:groupPost.content,upvotes:[],createdAt:Date.now()};
    const updated=[p,...groupFeed]; setGroupFeed(updated); DB.saveGroupFeed(activeGroup.id,updated);
    setGroupPost({title:"",content:""}); setShowGPost(false);
  };

  const planBadge = plan => {
    const colors={starter:"var(--txt3)",growth:"var(--blue)",pro:"var(--lime)",scale:"var(--purple)"};
    return <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:20,background:colors[plan]+"18",color:colors[plan],border:"1px solid "+colors[plan]+"30",textTransform:"uppercase",letterSpacing:".04em"}}>{plan}</span>;
  };

  const timeAgo = ts => {
    const s=Math.floor((Date.now()-ts)/1000);
    if(s<60)return "just now";
    const m=Math.floor(s/60); if(m<60)return m+"m ago";
    const h=Math.floor(m/60); if(h<24)return h+"h ago";
    return Math.floor(h/24)+"d ago";
  };

  // Group detail view
  if(activeGroup) return (
    <div>
      <button className="btn btn-ghost" style={{ marginBottom:16,fontSize:13 }} onClick={()=>setActiveGroup(null)}>
        ← Back to Community
      </button>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <div style={{ width:44,height:44,borderRadius:12,background:activeGroup.color+"18",border:"1.5px solid "+activeGroup.color+"30",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <I n="users" s={20} c={activeGroup.color}/>
          </div>
          <div>
            <h2 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:22,wordBreak:"break-word",overflowWrap:"break-word" }}>{activeGroup.name}</h2>
            <p style={{ color:"var(--txt2)",fontSize:13,marginTop:2 }}>{activeGroup.desc} · {activeGroup.memberCount+(myGroupIds.includes(activeGroup.id)?1:0)} members</p>
          </div>
        </div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          {myGroupIds.includes(activeGroup.id)&&<button className="btn btn-lime" onClick={()=>setShowGPost(true)}><I n="plus" s={14}/>Post to Group</button>}
          {myGroupIds.includes(activeGroup.id)
            ? <button className="btn btn-ghost" onClick={()=>leaveGroup(activeGroup.id)}>Leave Group</button>
            : <button className="btn btn-lime" onClick={()=>joinGroup(activeGroup.id)}><I n="plus" s={14}/>Join Group</button>}
        </div>
      </div>

      {!myGroupIds.includes(activeGroup.id) ? (
        <div style={{ textAlign:"center",padding:"60px 20px",background:"var(--s1)",borderRadius:16,border:"1.5px solid var(--brd)" }}>
          <I n="shield2" s={36} c="var(--txt3)"/>
          <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:18,marginTop:14,marginBottom:8 }}>Join to see group posts</h3>
          <p style={{ color:"var(--txt2)",fontSize:14,marginBottom:20 }}>This is a {activeGroup.private?"private":"public"} group. Join to participate.</p>
          <button className="btn btn-lime" onClick={()=>joinGroup(activeGroup.id)}><I n="plus" s={14}/>Join Group</button>
        </div>
      ) : (
        <>
          {showGPost && (
            <div className="card" style={{ padding:18,marginBottom:16,border:"1.5px solid rgba(198,241,53,.2)" }}>
              <div style={{ marginBottom:10 }}>
                <span className="lbl">Post Title</span>
                <input className="inp" placeholder="What do you want to share?" value={groupPost.title} onChange={e=>setGroupPost({...groupPost,title:e.target.value})}/>
              </div>
              <div style={{ marginBottom:12 }}>
                <span className="lbl">Content</span>
                <textarea className="inp" rows={4} placeholder="Share leads, wins, questions, or resources with the group…" value={groupPost.content} onChange={e=>setGroupPost({...groupPost,content:e.target.value})} style={{ resize:"vertical" }}/>
              </div>
              <div style={{ display:"flex",gap:7 }}>
                <button className="btn btn-lime" onClick={submitGroupPost} disabled={!groupPost.title||!groupPost.content}><I n="check" s={13}/>Post</button>
                <button className="btn btn-ghost" onClick={()=>setShowGPost(false)}>Cancel</button>
              </div>
            </div>
          )}

          {groupFeed.length===0 ? (
            <div style={{ textAlign:"center",padding:"60px 20px",color:"var(--txt2)" }}>
              <I n="users" s={32}/><p style={{ marginTop:12 }}>No posts yet. Be the first to share something!</p>
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {groupFeed.map(p=>(
                <div key={p.id} className="card" style={{ padding:"17px 20px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                    <div style={{ width:30,height:30,borderRadius:"50%",background:"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700 }}>
                      {p.authorName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize:13,fontWeight:600 }}>{p.authorName}</div>
                      <div style={{ fontSize:11,color:"var(--txt3)" }}>{timeAgo(p.createdAt)}</div>
                    </div>
                    {planBadge(p.authorPlan)}
                  </div>
                  <div style={{ fontFamily:"var(--fh)",fontWeight:700,fontSize:15,marginBottom:6 }}>{p.title}</div>
                  <p style={{ fontSize:13,color:"var(--txt2)",lineHeight:1.6 }}>{p.content}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  // Main community view
  return (
    <div style={{overflowX:"hidden",minWidth:0}}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10 }}>
        <div>
          <h2 style={{ fontFamily:"var(--fh)",fontWeight:900,fontSize:"clamp(18px,3vw,24px)",wordBreak:"break-word" }}>Community</h2>
          <p style={{ color:"var(--txt2)",fontSize:14,marginTop:4 }}>Share wins, discover opportunities, and connect with other freelancers.</p>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn btn-dark" onClick={()=>canCreateGroup?setShowCreate(true):setUpgradeFor({feature:"Group Creation",plan:"pro"})}>
            <I n="users" s={14}/>{canCreateGroup?"Create Group":"Create Group 🔒"}
          </button>
          <button className="btn btn-lime" onClick={()=>setShowPost(true)}><I n="plus" s={14}/>Share Post</button>
        </div>
      </div>

      {upgradeFor&&<UpgradeModal feature={upgradeFor.feature} requiredPlan={upgradeFor.plan} onClose={()=>setUpgradeFor(null)} onGoSettings={onGoSettings}/>}

      <div style={{ display:"grid",gridTemplateColumns:"minmax(0,1fr) 260px",gap:16,alignItems:"start" }} className="land-grid2">
        {/* Feed */}
        <div>
          {/* Type filters */}
          <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap" }}>
            {[{id:"all",label:"All Posts",color:"var(--txt2)"},...POST_TYPES].map(t=>(
              <button key={t.id} onClick={()=>setFilter(t.id)}
                style={{ padding:"5px 13px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s",
                  background:filter===t.id?t.color+"18":"var(--s2)",
                  color:filter===t.id?t.color:"var(--txt2)",
                  border:"1.5px solid "+(filter===t.id?t.color+"44":"var(--brd)") }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Post composer quick-open */}
          <div onClick={()=>setShowPost(true)} style={{ padding:"12px 16px",background:"var(--s2)",border:"1.5px solid var(--brd)",borderRadius:12,marginBottom:14,cursor:"pointer",display:"flex",gap:10,alignItems:"center",transition:"border-color .18s" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor="var(--brd2)"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="var(--brd)"}>
            <div style={{ width:32,height:32,borderRadius:"50%",background:"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700 }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize:13,color:"var(--txt3)" }}>Share a win, tip, or opportunity…</span>
            <div style={{ marginLeft:"auto",display:"flex",gap:6 }}>
              {POST_TYPES.map(t=>(
                <span key={t.id} style={{ fontSize:11,padding:"3px 9px",borderRadius:20,background:t.color+"12",color:t.color,border:"1px solid "+t.color+"22",fontWeight:600 }}>{t.label}</span>
              ))}
            </div>
          </div>

          {/* Posts */}
          {sorted.length===0
            ? <div style={{ textAlign:"center",padding:"60px 20px",color:"var(--txt2)" }}>
                <I n="users" s={32}/><p style={{ marginTop:12 }}>No posts yet. Be the first to share!</p>
              </div>
            : sorted.map(p=>{
              const typeInfo=POST_TYPES.find(t=>t.id===p.type)||POST_TYPES[0];
              const upvoted=p.upvotes.includes(user.email);
              return (
                <div key={p.id} className="card" style={{ padding:"18px 20px",marginBottom:10,transition:"border-color .18s" }}>
                  {/* Author row */}
                  <div style={{ display:"flex",alignItems:"center",gap:9,marginBottom:12 }}>
                    <div style={{ width:34,height:34,borderRadius:"50%",background:"var(--s3)",border:"2px solid var(--brd2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0 }}>
                      {p.authorName.charAt(0)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                        <span style={{ fontWeight:600,fontSize:13 }}>{p.authorName}</span>
                        {planBadge(p.authorPlan)}
                      </div>
                      <div style={{ fontSize:11,color:"var(--txt3)",marginTop:1 }}>
                        {p.country} · {timeAgo(p.createdAt)}
                      </div>
                    </div>
                    <span style={{ fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,
                      background:typeInfo.color+"12",color:typeInfo.color,border:"1px solid "+typeInfo.color+"28" }}>
                      {typeInfo.label}
                    </span>
                  </div>
                  {/* Content */}
                  <div style={{ fontFamily:"var(--fh)",fontWeight:700,fontSize:16,marginBottom:8,lineHeight:1.3 }}>{p.title}</div>
                  <p style={{ fontSize:13,color:"var(--txt2)",lineHeight:1.7,marginBottom:13 }}>{p.content}</p>
                  {/* Actions */}
                  <div style={{ display:"flex",gap:8,alignItems:"center",marginTop:2 }}>
                    <button onClick={()=>toggleUpvote(p.id)}
                      style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,cursor:"pointer",transition:"all .15s",
                        background:upvoted?"rgba(198,241,53,.1)":"var(--s2)",
                        border:"1.5px solid "+(upvoted?"var(--lime)":"var(--brd)"),
                        color:upvoted?"var(--lime)":"var(--txt2)",fontSize:13,fontWeight:600 }}>
                      ↑ {p.upvotes.length}
                    </button>
                    <button onClick={()=>toggleComments(p.id)}
                      style={{ display:"flex",alignItems:"center",gap:5,fontSize:13,
                        color:expandComment[p.id]?"var(--blue)":"var(--txt3)",
                        background:"none",border:"none",cursor:"pointer",padding:"5px 8px",
                        borderRadius:8,transition:"color .15s" }}>
                      <I n="note" s={13} c={expandComment[p.id]?"var(--blue)":"var(--txt3)"}/>
                      {p.comments.length} comment{p.comments.length!==1?"s":""}
                    </button>
                    {p.country&&<span style={{ fontSize:11,color:"var(--txt3)",marginLeft:"auto" }}>📍 {p.country}</span>}
                  </div>

                  {/* Comments expanded */}
                  {expandComment[p.id]&&(
                    <div style={{ marginTop:12,borderTop:"1px solid var(--brd)",paddingTop:12 }}>
                      {/* Existing comments */}
                      {p.comments.length>0&&(
                        <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:12 }}>
                          {p.comments.map(c=>(
                            <div key={c.id} style={{ display:"flex",gap:9,alignItems:"flex-start" }}>
                              <div style={{ width:26,height:26,borderRadius:"50%",background:"var(--s3)",border:"1.5px solid var(--brd)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0 }}>
                                {c.author.charAt(0)}
                              </div>
                              <div style={{ background:"var(--s2)",borderRadius:"0 10px 10px 10px",padding:"8px 12px",flex:1 }}>
                                <div style={{ fontSize:12,fontWeight:700,color:"var(--txt)",marginBottom:3 }}>{c.author}</div>
                                <div style={{ fontSize:13,color:"var(--txt2)",lineHeight:1.5 }}>{c.text}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Comment input */}
                      <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                        <div style={{ width:26,height:26,borderRadius:"50%",background:"var(--s3)",border:"1.5px solid var(--brd)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0 }}>
                          {user.name.charAt(0)}
                        </div>
                        <input
                          className="inp" style={{ flex:1,padding:"8px 12px",fontSize:13 }}
                          placeholder="Write a comment…"
                          value={commentDraft[p.id]||''}
                          onChange={e=>setCommentDraft(d=>({...d,[p.id]:e.target.value}))}
                          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&submitComment(p.id)}
                        />
                        <button className="btn btn-lime" style={{ padding:"8px 14px",fontSize:12,flexShrink:0 }}
                          onClick={()=>submitComment(p.id)}
                          disabled={!(commentDraft[p.id]||'').trim()}>
                          Post
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>

        {/* Sidebar: Groups */}
        <div style={{ position:"sticky",top:0 }}>
          <div className="card" style={{ padding:18,marginBottom:12 }}>
            <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:14,marginBottom:13,display:"flex",gap:7,alignItems:"center" }}>
              <I n="users" s={14} c="var(--lime)"/>Groups
            </div>
            {groups.map(g=>{
              const joined=myGroupIds.includes(g.id);
              return (
                <div key={g.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid var(--brd)",cursor:"pointer" }}
                  onClick={()=>openGroup(g)}>
                  <div style={{ width:34,height:34,borderRadius:9,background:g.color+"15",border:"1.5px solid "+g.color+"25",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <I n="users" s={14} c={g.color}/>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{g.name}</div>
                    <div style={{ fontSize:11,color:"var(--txt3)" }}>{g.memberCount+(joined?1:0)} members</div>
                  </div>
                  {joined
                    ? <button style={{ fontSize:10,color:"var(--lime)",fontWeight:700,background:"rgba(198,241,53,.08)",border:"1px solid rgba(198,241,53,.2)",borderRadius:20,padding:"3px 9px",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap",transition:"all .15s" }}
                        onMouseEnter={e=>{e.currentTarget.textContent="✕ Leave";e.currentTarget.style.color="var(--red)";e.currentTarget.style.background="rgba(245,66,66,.08)";e.currentTarget.style.borderColor="rgba(245,66,66,.2)";}}
                        onMouseLeave={e=>{e.currentTarget.textContent="✓ Joined";e.currentTarget.style.color="var(--lime)";e.currentTarget.style.background="rgba(198,241,53,.08)";e.currentTarget.style.borderColor="rgba(198,241,53,.2)";}}
                        onClick={e=>{e.stopPropagation();leaveGroup(g.id);}}>✓ Joined</button>
                    : <button className="btn btn-ghost" style={{ fontSize:11,padding:"3px 9px",flexShrink:0 }}
                        onClick={e=>{e.stopPropagation();joinGroup(g.id);}}>Join</button>}
                </div>
              );
            })}
            <button className="btn btn-dark" style={{ width:"100%",justifyContent:"center",marginTop:11,fontSize:13,padding:"9px" }}
              onClick={()=>canCreateGroup?setShowCreate(true):setUpgradeFor({feature:"Group Creation",plan:"pro"})}>
              <I n="plus" s={13}/>{canCreateGroup?"Create a Group":"Create Group (Pro+)"}
            </button>
          </div>

          {/* Your groups */}
          {myGroupIds.length>0 && (
            <div className="card" style={{ padding:18 }}>
              <div style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:13,marginBottom:11,color:"var(--txt2)" }}>YOUR GROUPS</div>
              {groups.filter(g=>myGroupIds.includes(g.id)).map(g=>(
                <div key={g.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid var(--brd)" }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:g.color,flexShrink:0,cursor:"pointer" }} onClick={()=>openGroup(g)}/>
                  <span style={{ fontSize:13,fontWeight:600,flex:1,cursor:"pointer" }} onClick={()=>openGroup(g)}>{g.name}</span>
                  <button style={{ fontSize:10,color:"var(--txt3)",background:"none",border:"none",cursor:"pointer",padding:"2px 6px",borderRadius:6,transition:"color .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.color="var(--red)"}
                    onMouseLeave={e=>e.currentTarget.style.color="var(--txt3)"}
                    onClick={e=>{e.stopPropagation();leaveGroup(g.id);}}>Leave</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New post modal */}
      {showPost&&(
        <div className="modal-wrap" onClick={e=>e.target===e.currentTarget&&setShowPost(false)}>
          <div className="modal" style={{ maxWidth:560 }}>
            <div style={{ padding:"17px 22px",borderBottom:"1.5px solid var(--brd)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:17 }}>Share with the Community</h3>
              <button className="btn btn-ghost" style={{ padding:"5px 7px" }} onClick={()=>setShowPost(false)}><I n="x" s={15}/></button>
            </div>
            <div style={{ padding:"18px 22px" }}>
              <div style={{ marginBottom:13 }}>
                <span className="lbl">Post Type</span>
                <div style={{ display:"flex",gap:7,flexWrap:"wrap",marginTop:6 }}>
                  {POST_TYPES.map(t=>(
                    <button key={t.id} onClick={()=>setNewPost({...newPost,type:t.id})}
                      style={{ padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",
                        background:newPost.type===t.id?t.color+"18":"var(--s2)",
                        color:newPost.type===t.id?t.color:"var(--txt2)",
                        border:"1.5px solid "+(newPost.type===t.id?t.color+"44":"var(--brd)") }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:13 }}>
                <span className="lbl">Title</span>
                <input className="inp" placeholder="Give your post a headline…" value={newPost.title} onChange={e=>setNewPost({...newPost,title:e.target.value})}/>
              </div>
              <div style={{ marginBottom:16 }}>
                <span className="lbl">Content</span>
                <textarea className="inp" rows={5} placeholder="Share the details — what happened, what you learned, what the opportunity is…"
                  value={newPost.content} onChange={e=>setNewPost({...newPost,content:e.target.value})} style={{ resize:"vertical" }}/>
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button className="btn btn-lime" onClick={submitPost} disabled={!newPost.title||!newPost.content}><I n="check" s={14}/>Post</button>
                <button className="btn btn-ghost" onClick={()=>setShowPost(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create group modal */}
      {showCreate&&(
        <div className="modal-wrap" onClick={e=>e.target===e.currentTarget&&setShowCreate(false)}>
          <div className="modal" style={{ maxWidth:480 }}>
            <div style={{ padding:"17px 22px",borderBottom:"1.5px solid var(--brd)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <h3 style={{ fontFamily:"var(--fh)",fontWeight:800,fontSize:17 }}>Create a Group</h3>
              <button className="btn btn-ghost" style={{ padding:"5px 7px" }} onClick={()=>setShowCreate(false)}><I n="x" s={15}/></button>
            </div>
            <div style={{ padding:"18px 22px" }}>
              <div style={{ marginBottom:13 }}>
                <span className="lbl">Group Name</span>
                <input className="inp" placeholder="e.g. UK SEO Freelancers" value={newGroup.name} onChange={e=>setNewGroup({...newGroup,name:e.target.value})}/>
              </div>
              <div style={{ marginBottom:13 }}>
                <span className="lbl">Description</span>
                <input className="inp" placeholder="What is this group for?" value={newGroup.desc} onChange={e=>setNewGroup({...newGroup,desc:e.target.value})}/>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:9,padding:"10px 13px",background:"var(--s2)",borderRadius:9,border:"1.5px solid var(--brd)",marginBottom:16,cursor:"pointer" }}
                onClick={()=>setNewGroup({...newGroup,private:!newGroup.private})}>
                <div style={{ width:18,height:18,borderRadius:5,border:"2px solid "+(newGroup.private?"var(--lime)":"var(--brd2)"),background:newGroup.private?"var(--lime)":"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  {newGroup.private&&<I n="check" s={11} c="#0c0e13"/>}
                </div>
                <div>
                  <div style={{ fontSize:13,fontWeight:600 }}>Private Group</div>
                  <div style={{ fontSize:11,color:"var(--txt3)" }}>Only members you invite can see posts</div>
                </div>
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <button className="btn btn-lime" disabled={!newGroup.name} onClick={()=>{
                  const g={id:"g_"+Date.now(),name:newGroup.name,desc:newGroup.desc,ownerId:user.email,ownerName:user.name,memberCount:1,private:newGroup.private,color:"var(--lime)",createdAt:Date.now()};
                  const updGroups=[...groups,g]; setGroups(updGroups); DB.saveGroups(updGroups);
                  const updMine=[...myGroupIds,g.id]; setMyGroupIds(updMine); DB.saveMyGroups(user.email,updMine);
                  setNewGroup({name:"",desc:"",private:false}); setShowCreate(false);
                }}><I n="check" s={14}/>Create Group</button>
                <button className="btn btn-ghost" onClick={()=>setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
