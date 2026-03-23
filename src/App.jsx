import React, { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const API_BASE = "https://airch-metas-api-production.up.railway.app";

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("metas_token") || "";
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

function isoDate(d) { return d.toISOString().slice(0, 10); }

function getWeekRange(d = new Date()) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - diff);
  mon.setHours(0, 0, 0, 0);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return { weekStart: isoDate(mon), weekEnd: isoDate(fri) };
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return isoDate(d);
}

function percent(done, target) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((done / target) * 100));
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

const S = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body,#root{background:#0a0a0f;color:#e8e6f0;font-family:'DM Sans',sans-serif;min-height:100vh;}
  .app{min-height:100vh;background:#0a0a0f;}
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;background:#0a0a0f;}
  .login-card{background:#13121a;border:1px solid #2a2837;border-radius:20px;padding:2.5rem;width:100%;max-width:400px;}
  .login-logo{height:48px;object-fit:contain;margin-bottom:1.5rem;}
  .login-title{font-family:'Syne',sans-serif;font-size:1.5rem;font-weight:700;color:#f0eeff;margin-bottom:0.25rem;}
  .login-sub{font-size:0.875rem;color:#6b6880;margin-bottom:2rem;}
  .field{margin-bottom:1rem;}
  .field label{display:block;font-size:0.78rem;font-weight:500;color:#6b6880;margin-bottom:0.4rem;letter-spacing:0.05em;text-transform:uppercase;}
  .field input,.field select{width:100%;background:#0f0e16;border:1px solid #2a2837;border-radius:10px;padding:0.7rem 1rem;color:#e8e6f0;font-size:0.95rem;font-family:'DM Sans',sans-serif;transition:border-color 0.2s;outline:none;}
  .field input:focus,.field select:focus{border-color:#7c3aed;}
  .field select option{background:#13121a;}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.7rem 1.25rem;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:0.9rem;font-weight:500;cursor:pointer;transition:all 0.15s;border:none;outline:none;}
  .btn:active{transform:scale(0.97);}
  .btn-primary{background:#7c3aed;color:#fff;width:100%;}
  .btn-primary:hover{background:#6d28d9;}
  .btn-primary:disabled{background:#3d2b6b;color:#7c6fa0;cursor:not-allowed;}
  .btn-ghost{background:transparent;color:#8884a0;border:1px solid #2a2837;}
  .btn-ghost:hover{background:#13121a;color:#e8e6f0;}
  .btn-ghost:disabled{opacity:0.5;cursor:not-allowed;}
  .btn-sm{padding:0.45rem 0.9rem;font-size:0.82rem;border-radius:8px;}
  .btn-full{width:100%;}
  .topbar{position:sticky;top:0;z-index:100;background:rgba(10,10,15,0.9);backdrop-filter:blur(12px);border-bottom:1px solid #1e1c2a;padding:0.75rem 1.5rem;display:flex;align-items:center;justify-content:space-between;}
  .topbar-logo{height:36px;object-fit:contain;}
  .topbar-title{font-family:'Syne',sans-serif;font-weight:600;font-size:1rem;color:#f0eeff;}
  .topbar-week{font-size:0.75rem;color:#6b6880;}
  .user-badge{background:#1e1c2a;border:1px solid #2a2837;border-radius:8px;padding:0.4rem 0.85rem;font-size:0.82rem;color:#a89ec0;}
  .main{max-width:1200px;margin:0 auto;padding:1.5rem;}
  .section-title{font-family:'Syne',sans-serif;font-size:1.3rem;font-weight:700;color:#f0eeff;}
  .section-sub{font-size:0.85rem;color:#6b6880;margin-top:0.25rem;margin-bottom:1.5rem;}
  .card{background:#13121a;border:1px solid #1e1c2a;border-radius:16px;padding:1.25rem;}
  .card-title{font-family:'Syne',sans-serif;font-size:1rem;font-weight:600;color:#f0eeff;margin-bottom:1rem;}
  .grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;}
  .grid-4{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.75rem;}
  .stat-card{background:#0f0e16;border:1px solid #1e1c2a;border-radius:12px;padding:1rem;}
  .stat-label{font-size:0.72rem;color:#6b6880;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.35rem;}
  .stat-value{font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:700;color:#f0eeff;}
  .progress-bar{height:6px;background:#1e1c2a;border-radius:99px;overflow:hidden;margin:0.4rem 0;}
  .progress-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#7c3aed,#a78bfa);transition:width 0.4s ease;}
  .progress-fill.done{background:linear-gradient(90deg,#10b981,#34d399);}
  .badge{display:inline-flex;align-items:center;padding:0.2rem 0.6rem;border-radius:6px;font-size:0.72rem;font-weight:500;}
  .badge-purple{background:#2d1f52;color:#a78bfa;}
  .badge-green{background:#0d2e23;color:#34d399;}
  .badge-amber{background:#2e1f0d;color:#fbbf24;}
  .badge-gray{background:#1e1c2a;color:#8884a0;}
  .tabs{display:flex;gap:0.25rem;background:#0f0e16;border:1px solid #1e1c2a;border-radius:10px;padding:0.25rem;margin-bottom:1.5rem;}
  .tab{flex:1;padding:0.55rem 1rem;border-radius:8px;font-size:0.85rem;font-weight:500;color:#6b6880;cursor:pointer;transition:all 0.15s;text-align:center;border:none;background:transparent;font-family:'DM Sans',sans-serif;}
  .tab.active{background:#1e1c2a;color:#f0eeff;}
  .tab:hover:not(.active){color:#a89ec0;}
  .user-row{background:#0f0e16;border:1px solid #1e1c2a;border-radius:12px;padding:1rem;margin-bottom:0.75rem;}
  .user-avatar{width:36px;height:36px;border-radius:50%;background:#2d1f52;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:0.85rem;font-weight:700;color:#a78bfa;flex-shrink:0;}
  .goal-card{background:#13121a;border:1px solid #1e1c2a;border-radius:16px;padding:1.25rem;display:flex;flex-direction:column;gap:1rem;}
  .goal-name{font-family:'Syne',sans-serif;font-size:1.05rem;font-weight:600;color:#f0eeff;}
  .goal-meta{font-size:0.78rem;color:#6b6880;margin-top:0.2rem;}
  .goal-done{font-family:'Syne',sans-serif;font-size:2rem;font-weight:800;color:#f0eeff;}
  .history-item{background:#0f0e16;border:1px solid #1e1c2a;border-radius:10px;padding:0.65rem 0.9rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;}
  .sep{border:none;border-top:1px solid #1e1c2a;margin:0.5rem 0;}
  .msg-success{font-size:0.85rem;color:#34d399;padding:0.4rem 0;}
  .msg-error{font-size:0.85rem;color:#f87171;padding:0.4rem 0;}
  .loading{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;}
  .alert{background:#1a1025;border:1px solid #3d2b6b;border-radius:12px;padding:1rem;}
  .alert-title{font-weight:500;color:#c4b5fd;margin-bottom:0.25rem;}
  .alert-desc{font-size:0.85rem;color:#8884a0;}
  .alert-error{background:#1a0f0f;border-color:#5a1f1f;}
  .alert-error .alert-title{color:#f87171;}
  ::-webkit-scrollbar{width:6px;}
  ::-webkit-scrollbar-track{background:#0a0a0f;}
  ::-webkit-scrollbar-thumb{background:#2a2837;border-radius:3px;}
  @media(max-width:640px){.main{padding:1rem;}.topbar{padding:0.75rem 1rem;}.grid-2,.grid-4{grid-template-columns:1fr;}}
`;

export default function App() {
  const { weekStart, weekEnd } = useMemo(() => getWeekRange(new Date()), []);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminUsers, setAdminUsers] = useState([]);
  const [allUsersProgress, setAllUsersProgress] = useState([]);
  const [myGoals, setMyGoals] = useState([]);
  const [myTasksByGoal, setMyTasksByGoal] = useState({});

  useEffect(() => {
    const token = localStorage.getItem("metas_token");
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const m = await apiFetch("/api/me");
        setSession({ id: m.id, role: m.role, name: m.name });
      } catch { localStorage.removeItem("metas_token"); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        if (session.role === "ADMIN") {
          const u = await apiFetch("/api/admin/users");
          const users = u.rows || [];
          setAdminUsers(users);
          const progArr = [];
          for (const user of users) {
            try {
              const g = await apiFetch(`/api/admin/goals?userId=${user.id}&weekStart=${weekStart}&weekEnd=${weekEnd}`);
              const goals = g.rows || [];
              const goalsWithTasks = [];
              for (const goal of goals) {
                const t = await apiFetch(`/api/my/tasks?goalId=${goal.id}`);
                goalsWithTasks.push({ ...goal, tasks: t.rows || [] });
              }
              progArr.push({ user, goals: goalsWithTasks });
            } catch {}
          }
          setAllUsersProgress(progArr);
        } else {
          await refreshMyData();
        }
      } catch (e) {
        if (e.status === 401) { localStorage.removeItem("metas_token"); setSession(null); }
      }
    })();
  }, [session]);

  async function refreshMyData() {
    const g = await apiFetch(`/api/my/goals?weekStart=${weekStart}&weekEnd=${weekEnd}`);
    const goals = g.rows || [];
    setMyGoals(goals);
    const map = {};
    for (const goal of goals) {
      const t = await apiFetch(`/api/my/tasks?goalId=${goal.id}`);
      map[goal.id] = t.rows || [];
    }
    setMyTasksByGoal(map);
  }

  function logout() {
    localStorage.removeItem("metas_token");
    setSession(null); setAdminUsers([]); setAllUsersProgress([]); setMyGoals([]); setMyTasksByGoal({});
  }

  if (loading) return <><style>{S}</style><div className="loading"><p style={{color:"#6b6880"}}>Carregando...</p></div></>;
  if (!session) return <><style>{S}</style><LoginScreen onLogin={p => setSession({ id: p.id, role: p.role, name: p.name })} /></>;

  return (
    <>
      <style>{S}</style>
      <div className="app">
        <TopBar session={session} weekStart={weekStart} weekEnd={weekEnd} onLogout={logout} />
        <div className="main">
          {session.role === "ADMIN"
            ? <AdminScreen weekStart={weekStart} weekEnd={weekEnd} users={adminUsers} allUsersProgress={allUsersProgress} setAllUsersProgress={setAllUsersProgress} />
            : <UserScreen weekStart={weekStart} weekEnd={weekEnd} goals={myGoals} tasksByGoal={myTasksByGoal} session={session} onRefresh={refreshMyData} />
          }
        </div>
      </div>
    </>
  );
}

function TopBar({ session, weekStart, weekEnd, onLogout }) {
  return (
    <div className="topbar">
      <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
        <img src="/logo-airch.png" alt="Airch" className="topbar-logo" />
        <div>
          <div className="topbar-title">Metas & Produção</div>
          <div className="topbar-week">Semana {weekStart} → {weekEnd}</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
        <span className="user-badge">{session.name}</span>
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>Sair</button>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const data = await apiFetch("/api/login", { method: "POST", body: JSON.stringify({ username: username.trim(), password }) });
      localStorage.setItem("metas_token", data.token);
      onLogin(data.user);
    } catch { setErr("Usuário ou senha inválidos."); }
    finally { setLoading(false); }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src="/logo-airch.png" alt="Airch" className="login-logo" />
        <div className="login-title">Bem-vindo</div>
        <div className="login-sub">Sistema de Metas Airch</div>
        {err && <div className="alert alert-error" style={{marginBottom:"1rem"}}><div className="alert-title">Erro</div><div className="alert-desc">{err}</div></div>}
        <form onSubmit={submit}>
          <div className="field"><label>Usuário</label><input value={username} onChange={e => setUsername(e.target.value)} placeholder="Digite seu usuário" autoComplete="username" /></div>
          <div className="field"><label>Senha</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Digite sua senha" autoComplete="current-password" /></div>
          <button className="btn btn-primary" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        </form>
      </div>
    </div>
  );
}

function AdminScreen({ weekStart, weekEnd, users, allUsersProgress, setAllUsersProgress }) {
  const [tab, setTab] = useState("progress");
  const [goalName, setGoalName] = useState("Montar Kits");
  const [goalType, setGoalType] = useState("COUNT");
  const [priority, setPriority] = useState("PRIMARY");
  const [targetUnits, setTargetUnits] = useState("200");
  const [bonus, setBonus] = useState("0");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserGoals, setSelectedUserGoals] = useState([]);
  const [msg, setMsg] = useState("");

  const totalGoals = allUsersProgress.reduce((a, p) => a + p.goals.length, 0);
  const totalDone = allUsersProgress.reduce((a, p) => a + p.goals.filter(g => {
    const done = g.goalType === "COUNT" ? g.tasks.reduce((s,t) => s+(Number(t.qty)||0),0) : new Set(g.tasks.map(t=>t.dayDate).filter(Boolean)).size;
    const target = g.goalType === "COUNT" ? Number(g.targetUnits||0) : Number(g.targetDays||5);
    return done >= target && target > 0;
  }).length, 0);

  async function loadGoals(userId) {
    if (!userId) return;
    try {
      const data = await apiFetch(`/api/admin/goals?userId=${userId}&weekStart=${weekStart}&weekEnd=${weekEnd}`);
      setSelectedUserGoals(data.rows || []);
    } catch {}
  }

  useEffect(() => { if (selectedUserId) loadGoals(selectedUserId); }, [selectedUserId]);

  async function createGoal() {
    setMsg("");
    if (!selectedUserId) { setMsg("Selecione um colaborador."); return; }
    if (!goalName.trim()) { setMsg("Informe o nome da meta."); return; }
    const tu = Number(targetUnits);
    if (goalType === "COUNT" && (!tu || tu <= 0)) { setMsg("Quantidade inválida."); return; }
    try {
      await apiFetch("/api/admin/goals", { method: "POST", body: JSON.stringify({
        userId: Number(selectedUserId), weekStart, weekEnd, name: goalName.trim(),
        goalType, priority, targetUnits: goalType === "COUNT" ? tu : 0,
        activeDays: goalType === "DAYS" ? [0,1,2,3,4] : [], bonus: Number(bonus||0),
      })});
      setMsg("✓ Meta criada!");
      await loadGoals(selectedUserId);
      // atualiza progresso geral
      const g = await apiFetch(`/api/admin/goals?userId=${Number(selectedUserId)}&weekStart=${weekStart}&weekEnd=${weekEnd}`);
      const goals = g.rows || [];
      const gwt = [];
      for (const goal of goals) { const t = await apiFetch(`/api/my/tasks?goalId=${goal.id}`); gwt.push({...goal, tasks: t.rows||[]}); }
      setAllUsersProgress(prev => {
        const exists = prev.find(p => String(p.user.id) === String(selectedUserId));
        if (exists) return prev.map(p => String(p.user.id) === String(selectedUserId) ? {...p, goals: gwt} : p);
        const user = users.find(u => String(u.id) === String(selectedUserId));
        return user ? [...prev, { user, goals: gwt }] : prev;
      });
      setTimeout(() => setMsg(""), 3000);
    } catch { setMsg("Erro ao criar meta."); }
  }

  return (
    <div>
      <div className="section-title">Painel Admin</div>
      <div className="section-sub">Semana {weekStart} → {weekEnd} · {users.length} colaboradores</div>

      <div className="grid-4" style={{marginBottom:"1.5rem"}}>
        <div className="stat-card"><div className="stat-label">Colaboradores</div><div className="stat-value">{users.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Metas</div><div className="stat-value">{totalGoals}</div></div>
        <div className="stat-card"><div className="stat-label">Metas Batidas</div><div className="stat-value" style={{color:"#34d399"}}>{totalDone}</div></div>
        <div className="stat-card"><div className="stat-label">Em Progresso</div><div className="stat-value" style={{color:"#a78bfa"}}>{totalGoals - totalDone}</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab==="progress"?"active":""}`} onClick={() => setTab("progress")}>Progresso</button>
        <button className={`tab ${tab==="create"?"active":""}`} onClick={() => setTab("create")}>Criar Meta</button>
        <button className={`tab ${tab==="list"?"active":""}`} onClick={() => setTab("list")}>Ver Metas</button>
      </div>

      {tab === "progress" && (
        <div>
          {allUsersProgress.length === 0 && <div className="alert"><div className="alert-title">Nenhum dado</div><div className="alert-desc">Crie metas para os colaboradores primeiro.</div></div>}
          {allUsersProgress.map(({ user, goals }) => <UserProgressRow key={user.id} user={user} goals={goals} />)}
        </div>
      )}

      {tab === "create" && (
        <div className="card" style={{maxWidth:560}}>
          <div className="card-title">Nova Meta</div>
          <div className="field"><label>Colaborador</label>
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
              <option value="">Selecione...</option>
              {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
            </select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem"}}>
            <div className="field"><label>Prioridade</label><select value={priority} onChange={e => setPriority(e.target.value)}><option value="PRIMARY">Principal</option><option value="EXTRA">Extra</option></select></div>
            <div className="field"><label>Tipo</label><select value={goalType} onChange={e => setGoalType(e.target.value)}><option value="COUNT">Por contagem</option><option value="DAYS">Por dia</option></select></div>
          </div>
          <div className="field"><label>Nome da meta</label><input value={goalName} onChange={e => setGoalName(e.target.value)} /></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem"}}>
            {goalType === "COUNT" && <div className="field"><label>Quantidade alvo</label><input value={targetUnits} onChange={e => setTargetUnits(e.target.value)} inputMode="numeric" /></div>}
            <div className="field"><label>Bônus (R$)</label><input value={bonus} onChange={e => setBonus(e.target.value)} inputMode="numeric" /></div>
          </div>
          <button className="btn btn-primary" onClick={createGoal} disabled={!selectedUserId}>Criar meta</button>
          {msg && <p className={msg.includes("✓") ? "msg-success" : "msg-error"}>{msg}</p>}
        </div>
      )}

      {tab === "list" && (
        <div>
          <div className="card" style={{maxWidth:400,marginBottom:"1rem"}}>
            <div className="field" style={{margin:0}}><label>Colaborador</label>
              <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                <option value="">Selecione...</option>
                {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
              </select>
            </div>
          </div>
          {selectedUserId && selectedUserGoals.length === 0 && <div className="alert"><div className="alert-title">Sem metas</div><div className="alert-desc">Nenhuma meta para esta semana.</div></div>}
          <div className="grid-2">
            {selectedUserGoals.map(g => (
              <div key={g.id} className="card">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"0.5rem"}}>
                  <div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:600,color:"#f0eeff"}}>{g.name}</div><div style={{fontSize:"0.78rem",color:"#6b6880",marginTop:"0.2rem"}}>{g.priority==="PRIMARY"?"Principal":"Extra"} · {g.goalType==="COUNT"?"Contagem":"Por dia"}</div></div>
                  <span className={`badge ${g.priority==="PRIMARY"?"badge-purple":"badge-amber"}`}>{g.goalType==="COUNT"?`Alvo: ${g.targetUnits}`:"5 dias"}</span>
                </div>
                {Number(g.bonus) > 0 && <div style={{marginTop:"0.5rem"}}><span className="badge badge-green">Bônus: R$ {Number(g.bonus).toFixed(2)}</span></div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserProgressRow({ user, goals }) {
  const [open, setOpen] = useState(false);
  const initials = user.name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
  const primary = goals.find(g => g.priority === "PRIMARY");
  const calcDone = (g) => g.goalType === "COUNT" ? g.tasks.reduce((s,t)=>s+(Number(t.qty)||0),0) : new Set(g.tasks.map(t=>t.dayDate).filter(Boolean)).size;
  const calcTarget = (g) => g.goalType === "COUNT" ? Number(g.targetUnits||0) : Number(g.targetDays||5);
  const pDone = primary ? calcDone(primary) : 0;
  const pTarget = primary ? calcTarget(primary) : 0;
  const pct = percent(pDone, pTarget);
  const batida = pTarget > 0 && pDone >= pTarget;

  return (
    <div className="user-row">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.75rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <div className="user-avatar">{initials}</div>
          <div>
            <div style={{fontWeight:500,color:"#e8e6f0"}}>{user.name}</div>
            <div style={{fontSize:"0.75rem",color:"#6b6880"}}>{goals.length} meta{goals.length!==1?"s":""}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
          {batida && <span className="badge badge-green">Batida!</span>}
          <span className="badge badge-purple">{pct}%</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}>{open?"Fechar":"Detalhes"}</button>
        </div>
      </div>
      {primary && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.78rem",color:"#6b6880",marginBottom:"0.25rem"}}>
            <span>{primary.name}</span><span>{pDone} / {pTarget}</span>
          </div>
          <div className="progress-bar"><div className={`progress-fill ${batida?"done":""}`} style={{width:`${pct}%`}} /></div>
        </div>
      )}
      {open && goals.length > 0 && (
        <div style={{marginTop:"0.75rem",display:"flex",flexDirection:"column",gap:"0.6rem"}}>
          <hr className="sep" />
          {goals.map(g => {
            const done = calcDone(g); const target = calcTarget(g); const p = percent(done, target); const b = target > 0 && done >= target;
            return (
              <div key={g.id}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.25rem"}}>
                  <div><span style={{fontSize:"0.85rem",color:"#e8e6f0",fontWeight:500}}>{g.name}</span><span style={{fontSize:"0.72rem",color:"#6b6880",marginLeft:"0.4rem"}}>{g.priority==="PRIMARY"?"Principal":"Extra"}</span></div>
                  <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
                    {b && <span className="badge badge-green">Batida</span>}
                    {Number(g.bonus)>0 && <span className="badge badge-amber">R$ {Number(g.bonus).toFixed(2)}</span>}
                    <span style={{fontSize:"0.75rem",color:"#6b6880"}}>{done}/{target}</span>
                  </div>
                </div>
                <div className="progress-bar"><div className={`progress-fill ${b?"done":""}`} style={{width:`${p}%`}} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserScreen({ weekStart, weekEnd, goals, tasksByGoal, session, onRefresh }) {
  const totalBonus = goals.reduce((acc, g) => {
    if (!g.bonus || Number(g.bonus) <= 0) return acc;
    const tasks = tasksByGoal[g.id] || [];
    const done = g.goalType === "COUNT" ? tasks.reduce((s,t)=>s+(Number(t.qty)||0),0) : new Set(tasks.map(t=>t.dayDate).filter(Boolean)).size;
    const target = g.goalType === "COUNT" ? Number(g.targetUnits||0) : Number(g.targetDays||5);
    return acc + (done >= target ? Number(g.bonus) : 0);
  }, 0);
  const batidas = goals.filter(g => {
    const tasks = tasksByGoal[g.id] || [];
    const done = g.goalType === "COUNT" ? tasks.reduce((s,t)=>s+(Number(t.qty)||0),0) : new Set(tasks.map(t=>t.dayDate).filter(Boolean)).size;
    const target = g.goalType === "COUNT" ? Number(g.targetUnits||0) : Number(g.targetDays||5);
    return done >= target && target > 0;
  }).length;

  return (
    <div>
      <div className="section-title">Olá, {session.name.split(" ")[0]}</div>
      <div className="section-sub">Suas metas desta semana</div>
      <div className="grid-4" style={{marginBottom:"1.5rem"}}>
        <div className="stat-card"><div className="stat-label">Metas</div><div className="stat-value">{goals.length}</div></div>
        <div className="stat-card"><div className="stat-label">Batidas</div><div className="stat-value" style={{color:"#34d399"}}>{batidas}</div></div>
        <div className="stat-card"><div className="stat-label">Bônus</div><div className="stat-value" style={{color:"#fbbf24",fontSize:"1.3rem"}}>R$ {totalBonus.toFixed(2)}</div></div>
      </div>
      {goals.length === 0 && <div className="alert"><div className="alert-title">Sem metas esta semana</div><div className="alert-desc">Aguarde o administrador criar suas metas.</div></div>}
      <div className="grid-2">
        {goals.map(g => <GoalCard key={g.id} goal={g} tasks={tasksByGoal[g.id]||[]} onRefresh={onRefresh} />)}
      </div>
    </div>
  );
}

function GoalCard({ goal, tasks, onRefresh }) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isCount = goal.goalType === "COUNT";
  const doneCount = isCount ? tasks.reduce((a,t)=>a+(Number(t.qty)||0),0) : 0;
  const doneDaysSet = !isCount ? new Set(tasks.map(t=>t.dayDate).filter(Boolean)) : new Set();
  const done = isCount ? doneCount : doneDaysSet.size;
  const target = isCount ? Number(goal.targetUnits||0) : Number(goal.targetDays||5);
  const remaining = Math.max(target - done, 0);
  const pct = percent(done, target);
  const batida = target > 0 && done >= target;
  const alreadyToday = doneDaysSet.has(todayISO());
  const todayIdx = new Date().getDay();
  const canMarkToday = todayIdx >= 1 && todayIdx <= 5;
  const chartData = [{name:"Feito",value:Math.max(done,0)},{name:"Falta",value:Math.max(remaining,0)||(batida?0:1)}];
  const CC = batida ? ["#10b981","#1e1c2a"] : ["#7c3aed","#1e1c2a"];

  async function submitCount(e) {
    e.preventDefault(); setErr("");
    const q = Math.floor(Number(qty));
    if (!q||q<=0) { setErr("Informe uma quantidade válida."); return; }
    setSubmitting(true);
    try { await apiFetch("/api/my/tasks/count",{method:"POST",body:JSON.stringify({goalId:goal.id,qty:q,note})}); setQty(""); setNote(""); await onRefresh(); }
    catch { setErr("Erro ao registrar."); }
    finally { setSubmitting(false); }
  }

  async function markDay() {
    setSubmitting(true);
    try { await apiFetch("/api/my/tasks/day",{method:"POST",body:JSON.stringify({goalId:goal.id,dayDate:todayISO(),note:""})}); await onRefresh(); }
    catch { setErr("Erro ao marcar."); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="goal-card">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"1rem"}}>
        <div><div className="goal-name">{goal.name}</div><div className="goal-meta">{goal.priority==="PRIMARY"?"Meta principal":"Meta extra"} · {isCount?"Por contagem":"Por dia"}</div></div>
        <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",justifyContent:"flex-end"}}>
          {batida && <span className="badge badge-green">Batida!</span>}
          <span className={`badge ${batida?"badge-green":"badge-purple"}`}>{pct}%</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"110px 1fr",gap:"1rem",alignItems:"center"}}>
        <ResponsiveContainer width="100%" height={110}>
          <PieChart><Pie data={chartData} dataKey="value" innerRadius={32} outerRadius={48} paddingAngle={2} stroke="none">{chartData.map((_,i)=><Cell key={i} fill={CC[i]}/>)}</Pie></PieChart>
        </ResponsiveContainer>
        <div>
          <div style={{display:"flex",alignItems:"baseline",gap:"0.4rem"}}>
            <div className="goal-done">{done}</div>
            <div style={{fontSize:"0.9rem",color:"#6b6880"}}>/ {target}</div>
          </div>
          <div style={{fontSize:"0.78rem",color:"#8884a0"}}>Faltam {remaining} {isCount?"unidades":"dias"}</div>
          <div className="progress-bar"><div className={`progress-fill ${batida?"done":""}`} style={{width:`${pct}%`}} /></div>
          {Number(goal.bonus)>0 && <span className="badge badge-amber" style={{marginTop:"0.4rem"}}>Bônus: R$ {Number(goal.bonus).toFixed(2)}</span>}
        </div>
      </div>

      <hr className="sep" />

      {isCount ? (
        <form onSubmit={submitCount} style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
          <div className="field" style={{margin:0}}><label>Quantidade feita</label><input value={qty} onChange={e=>setQty(e.target.value)} inputMode="numeric" placeholder="Ex: 25"/></div>
          <div className="field" style={{margin:0}}><label>Observação (opcional)</label><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex: faltou material"/></div>
          {err && <p className="msg-error">{err}</p>}
          <button className="btn btn-primary" disabled={submitting}>{submitting?"Registrando...":"Registrar"}</button>
        </form>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
          <div style={{fontSize:"0.82rem",color:"#6b6880"}}>Marque uma vez por dia (Seg–Sex)</div>
          {err && <p className="msg-error">{err}</p>}
          <button className={`btn btn-full ${alreadyToday?"btn-ghost":"btn-primary"}`} disabled={!canMarkToday||alreadyToday||submitting} onClick={markDay}>
            {alreadyToday?"Já marcado hoje ✓":!canMarkToday?"Fora de Seg–Sex":"Marcar como feito hoje"}
          </button>
        </div>
      )}

      {tasks.length > 0 && (
        <>
          <hr className="sep" />
          <div>
            <div style={{fontSize:"0.78rem",color:"#6b6880",marginBottom:"0.5rem",display:"flex",justifyContent:"space-between"}}>
              <span>Histórico</span><span>{tasks.length} registros</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.4rem",maxHeight:"160px",overflowY:"auto"}}>
              {tasks.slice(0,20).map(t => (
                <div key={t.id} className="history-item">
                  <div>
                    <div style={{fontSize:"0.88rem",fontWeight:500,color:"#e8e6f0"}}>{isCount?`+${t.qty} unidades`:`Dia: ${t.dayDate}`}</div>
                    <div style={{fontSize:"0.72rem",color:"#6b6880"}}>{formatDate(t.createdAt)}{t.note?` · ${t.note}`:""}</div>
                  </div>
                  <span className={`badge ${isCount?"badge-purple":"badge-green"}`}>{isCount?`+${t.qty}`:"OK"}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
ß