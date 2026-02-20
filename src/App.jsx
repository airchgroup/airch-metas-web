import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Lock, LogOut, Target, User, Settings2, CheckCircle2, Plus, Trash2 } from "lucide-react";

/**
 * AIRCH METAS — LOCAL MVP (sem banco) — METAS GENÉRICAS
 * Semana: SEG–SEX
 *
 * Admin cria N metas por usuário/semana:
 * - Nome custom (string)
 * - Tipo: COUNT (quantidade) ou DAYS (marca HOJE, com dias ativos Seg–Sex)
 * - Prioridade: PRIMARY ou EXTRA
 * - Bônus fixo ao bater
 *
 * Funcionário vê TODAS metas e registra:
 * - COUNT: lança quantidade
 * - DAYS: marca HOJE ✅ (só se dia estiver ativo)
 *
 * % trava em 100%, mas o "feito" pode passar do alvo (modo A).
 */

const LS_KEY = "airch_metas_local_v5";
const API_BASE = "http://localhost:3001"; // local only
function apiEnabled() { return Boolean(API_BASE); }

const COLORS = ["#111827", "#E5E7EB"]; // feito, falta

function isoDate(d) { return d.toISOString().slice(0, 10); }
function toLocalDateISO(d = new Date()) {
  const x = new Date(d);
  const tz = x.getTimezoneOffset() * 60000;
  return new Date(x.getTime() - tz).toISOString().slice(0, 10);
}
function isWeekdayLocal(d = new Date()) {
  const day = d.getDay(); // 1..5
  return day >= 1 && day <= 5;
}
function getWeekRangeMonFri(d = new Date()) {
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { weekStart: isoDate(monday), weekEnd: isoDate(friday), monday };
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function percent(done, target) {
  if (!target || target <= 0) return 0;
  return Math.round((done / target) * 100);
}
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
function brl(n) {
  const x = Number(n || 0);
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function weekdayLabel(i) { return ["Seg", "Ter", "Qua", "Qui", "Sex"][i] || ""; }

function loadStore() {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const seed = {
    users: [
      { id: "u_admin", name: "Hugo (Admin)", username: "admin", password: "admin123", role: "ADMIN", active: true },
      { id: "u_douglas", name: "Douglas", username: "douglas", password: "1234", role: "USER", active: true },
      { id: "u_lucas", name: "Lucas", username: "lucas", password: "1234", role: "USER", active: true },
    ],
    goals: [],
    tasks: [],
  };
  localStorage.setItem(LS_KEY, JSON.stringify(seed));
  return seed;
}
function saveStore(store) { localStorage.setItem(LS_KEY, JSON.stringify(store)); }

function sumQtyTasks(tasks, goalId) {
  return tasks
    .filter((t) => t.goalId === goalId && typeof t.qty === "number" && !t.dayDate)
    .reduce((acc, t) => acc + (Number(t.qty) || 0), 0);
}
function countDaysDone(tasks, goalId) {
  const set = new Set(
    tasks.filter((t) => t.goalId === goalId && t.dayDate).map((t) => t.dayDate)
  );
  return set.size;
}
function formatDT(ts) {
  const d = new Date(ts);
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function goalBadge(g) {
  return g.priority === "PRIMARY" ? "Principal" : "Extra";
}

export default function App() {
  const [store, setStore] = useState(() => loadStore());
  const [session, setSession] = useState(null);

  const { weekStart, weekEnd } = useMemo(() => getWeekRangeMonFri(new Date()), []);

  useEffect(() => {
    if (!apiEnabled()) saveStore(store);
  }, [store]);

  const me = useMemo(() => {
    if (!session) return null;
    return store.users.find((u) => u.id === session.userId) || null;
  }, [session, store.users]);

  function logout() { setSession(null); }

  function resetData() {
    const ok = confirm("Resetar metas e lançamentos? (Mantém usuários).");
    if (!ok) return;
    const fresh = loadStore();
    fresh.goals = [];
    fresh.tasks = [];
    localStorage.setItem(LS_KEY, JSON.stringify(fresh));
    setStore(fresh);
    setSession(null);
  }

  function getGoalsForUser(userId) {
    return store.goals
      .filter(
        (g) =>
          g.userId === userId &&
          g.weekStart === weekStart &&
          g.weekEnd === weekEnd &&
          g.status === "ACTIVE"
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  function createGoal(payload) {
    setStore((prev) => {
      const goals = [
        {
          id: uid("goal"),
          userId: payload.userId,
          weekStart,
          weekEnd,
          name: payload.name.trim(),
          goalType: payload.goalType, // COUNT | DAYS
          priority: payload.priority, // PRIMARY | EXTRA
          targetUnits: payload.goalType === "COUNT" ? Number(payload.targetUnits || 0) : 0,
          targetDays: payload.goalType === "DAYS" ? Number(payload.targetDays || 0) : 0,
          activeDays: payload.goalType === "DAYS" ? (payload.activeDays || [0,1,2,3,4]) : [],
          bonus: Number(payload.bonus || 0),
          status: "ACTIVE",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        ...prev.goals,
      ];
      return { ...prev, goals };
    });
  }

  function updateGoal(goalId, patch) {
    setStore((prev) => {
      const goals = prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const next = { ...g, ...patch, updatedAt: Date.now() };
        // manter coerência
        if (next.goalType === "COUNT") {
          next.targetDays = 0;
          next.activeDays = [];
        } else {
          next.targetUnits = 0;
          if (!Array.isArray(next.activeDays) || next.activeDays.length === 0) next.activeDays = [0,1,2,3,4];
          next.targetDays = next.activeDays.length; // meta = qtd dias ativos
        }
        return next;
      });
      return { ...prev, goals };
    });
  }

  function disableGoal(goalId) {
    setStore((prev) => {
      const goals = prev.goals.map((g) => (g.id === goalId ? { ...g, status: "INACTIVE", updatedAt: Date.now() } : g));
      return { ...prev, goals };
    });
  }

  function addTaskCount({ userId, goalId, qty, note }) {
    setStore((prev) => {
      const tasks = [
        { id: uid("task"), userId, goalId, qty: Number(qty), note: note || "", createdAt: Date.now() },
        ...prev.tasks,
      ];
      return { ...prev, tasks };
    });
  }

  function markDoneToday({ userId, goalId, goal, note }) {
    const now = new Date();
    const today = toLocalDateISO(now);

    if (!isWeekdayLocal(now)) return { ok: false, reason: "Hoje não é dia útil (Seg–Sex)." };

    const dayIndex = now.getDay() - 1; // seg=0..sex=4
    if (!goal.activeDays?.includes(dayIndex)) {
      return { ok: false, reason: "Hoje NÃO está ativo nessa meta (admin desmarcou o dia)." };
    }

    setStore((prev) => {
      const exists = prev.tasks.some((t) => t.goalId === goalId && t.dayDate === today);
      if (exists) return prev;

      const tasks = [
        { id: uid("task"), userId, goalId, qty: 1, dayDate: today, note: note || "", createdAt: Date.now() },
        ...prev.tasks,
      ];
      return { ...prev, tasks };
    });

    return { ok: true };
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Login users={store.users.filter((u) => u.active)} onLogin={(payload) => setSession(payload)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar me={me} weekStart={weekStart} weekEnd={weekEnd} onLogout={logout} />
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        {me.role === "ADMIN" ? (
          <AdminView
            store={store}
            weekStart={weekStart}
            weekEnd={weekEnd}
            getGoalsForUser={getGoalsForUser}
            onCreateGoal={createGoal}
            onUpdateGoal={updateGoal}
            onDisableGoal={disableGoal}
            onReset={resetData}
          />
        ) : (
          <UserView
            me={me}
            store={store}
            weekStart={weekStart}
            weekEnd={weekEnd}
            goals={getGoalsForUser(me.id)}
            onAddTaskCount={addTaskCount}
            onMarkDoneToday={markDoneToday}
          />
        )}
      </div>
    </div>
  );
}

function TopBar({ me, weekStart, weekEnd, onLogout }) {
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
  <img
  src="/logo-airch.png"
  alt="Airch"
  className="h-12 object-contain"
/>


  <div>
    <div className="font-semibold">Metas &amp; Produção</div>
    <div className="text-xs text-slate-500">
      Semana: {weekStart} → {weekEnd} (Seg–Sex)
    </div>
  </div>
</div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <User className="h-3.5 w-3.5" /> {me.name}
          </Badge>
          <Button variant="secondary" onClick={onLogout} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

function Login({ users, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  function submit(e) {
    e.preventDefault();
    setErr("");
    const u = users.find((x) => x.username === username.trim() && x.password === password);
    if (!u) return setErr("Usuário ou senha inválidos.");
    onLogin({ userId: u.id, role: u.role, name: u.name });
  }

  return (
    <Card className="w-full max-w-md rounded-2xl shadow-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-col items-center gap-2">
  <img
    src="/logo-airch.png"
    alt="Airch"
    className="h-24 object-contain"
  />

  <div className="text-center">
    <div className="font-semibold text-lg">Entrar</div>
    <div className="text-sm text-slate-500">
      Sistema de Metas Airch
    </div>
  </div>
</div>


        {err ? (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Usuário</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: admin" />
          </div>
          <div className="space-y-1">
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ex: admin123" />
          </div>
          <Button className="w-full">Entrar</Button>
        </form>

        <div className="text-xs text-slate-500">
          Contas: <span className="font-medium">admin/admin123</span>,{" "}
          <span className="font-medium">douglas/1234</span>,{" "}
          <span className="font-medium">lucas/1234</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- ADMIN ---------------- */

function AdminView({ store, weekStart, weekEnd, getGoalsForUser, onCreateGoal, onUpdateGoal, onDisableGoal, onReset }) {
  const users = store.users.filter((u) => u.role === "USER" && u.active);
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || "");
  const goals = selectedUserId ? getGoalsForUser(selectedUserId) : [];

  // form create
  const [name, setName] = useState("Montar Kit");
  const [goalType, setGoalType] = useState("COUNT"); // COUNT | DAYS
  const [priority, setPriority] = useState("PRIMARY"); // PRIMARY | EXTRA
  const [targetUnits, setTargetUnits] = useState("200");
  const [activeDays, setActiveDays] = useState([0,1,2,3,4]);
  const [bonus, setBonus] = useState("0");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!users.length) return;
    if (!selectedUserId) setSelectedUserId(users[0].id);
  }, [users.length, selectedUserId]);

  function toggleDay(i) {
    setActiveDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()));
  }

  function create() {
    const n = name.trim();
    if (!n) return setMsg("Informe um nome para a meta.");
    if (goalType === "COUNT") {
      const q = Math.floor(Number(targetUnits));
      if (!q || q <= 0) return setMsg("Quantidade inválida.");
      onCreateGoal({
        userId: selectedUserId,
        name: n,
        goalType,
        priority,
        targetUnits: q,
        bonus: Number(bonus || 0),
      });
    } else {
      if (!activeDays.length) return setMsg("Selecione ao menos 1 dia ativo.");
      onCreateGoal({
        userId: selectedUserId,
        name: n,
        goalType,
        priority,
        activeDays,
        targetDays: activeDays.length,
        bonus: Number(bonus || 0),
      });
    }
    setMsg("Meta criada!");
    setTimeout(() => setMsg(""), 900);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">Colaboradores</div>
            <div className="text-2xl font-semibold">{users.length}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">Semana</div>
            <div className="text-sm font-medium">{weekStart} → {weekEnd}</div>
            <div className="text-xs text-slate-500">Você pode criar várias metas por pessoa.</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Ações</div>
              <div className="text-sm">Resetar metas/lançamentos</div>
            </div>
            <Button variant="secondary" onClick={onReset} className="gap-2">
              <Settings2 className="h-4 w-4" /> Reset
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="font-semibold">Criar meta (Admin)</div>
              <div className="text-sm text-slate-500">Semana {weekStart} → {weekEnd}</div>
            </div>
            <Badge variant="secondary">Personalize nome + tipo + prioridade</Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-1">
              <Label>Colaborador</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem value={u.id} key={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">Principal</SelectItem>
                  <SelectItem value="EXTRA">Extra (bônus)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Nome da meta</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Montar Kit / Montar pedidos do dia" />
            </div>

            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={goalType} onValueChange={setGoalType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COUNT">Contagem (quantidade na semana)</SelectItem>
                  <SelectItem value="DAYS">Por dia (marcar HOJE ✅)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Bônus ao bater (R$)</Label>
              <Input value={bonus} onChange={(e) => setBonus(e.target.value)} inputMode="decimal" placeholder="Ex: 30" />
            </div>

            {goalType === "COUNT" ? (
              <div className="space-y-1 md:col-span-2">
                <Label>Quantidade (meta semanal)</Label>
                <Input value={targetUnits} onChange={(e) => setTargetUnits(e.target.value)} inputMode="numeric" placeholder="Ex: 200" />
              </div>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <Label>Dias ativos (Seg–Sex)</Label>
                <div className="flex gap-2 flex-wrap">
                  {[0,1,2,3,4].map((i) => (
                    <Button
                      key={i}
                      type="button"
                      variant={activeDays.includes(i) ? "default" : "secondary"}
                      onClick={() => toggleDay(i)}
                    >
                      {weekdayLabel(i)}
                    </Button>
                  ))}
                </div>
                <div className="text-xs text-slate-500">
                  O alvo da meta diária será a quantidade de dias ativos (ex.: 3 dias ativos = meta 3).
                </div>
              </div>
            )}

            <Button onClick={create} className="w-full md:col-span-2 gap-2">
              <Plus className="h-4 w-4" /> Criar meta
            </Button>

            {msg ? <div className="text-xs text-slate-500 md:col-span-2">{msg}</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 md:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="font-semibold">Metas do colaborador</div>
              <div className="text-sm text-slate-500">
                {users.find((u) => u.id === selectedUserId)?.name || ""}
              </div>
            </div>
            <Badge variant="secondary">{goals.length} metas</Badge>
          </div>

          <Separator />

          {goals.length === 0 ? (
            <div className="text-sm text-slate-500">Nenhuma meta ativa nesta semana.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {goals.map((g) => (
                <AdminGoalCard
                  key={g.id}
                  goal={g}
                  store={store}
                  onUpdateGoal={onUpdateGoal}
                  onDisableGoal={onDisableGoal}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminGoalCard({ goal, store, onUpdateGoal, onDisableGoal }) {
  const done = goal.goalType === "DAYS" ? countDaysDone(store.tasks, goal.id) : sumQtyTasks(store.tasks, goal.id);
  const target = goal.goalType === "DAYS" ? (goal.targetDays || 0) : (goal.targetUnits || 0);

  const pct = clamp(percent(done, target), 0, 100);
  const remaining = Math.max(target - done, 0);

  const [name, setName] = useState(goal.name);
  const [bonus, setBonus] = useState(String(goal.bonus || 0));
  const [targetUnits, setTargetUnits] = useState(String(goal.targetUnits || 0));
  const [activeDays, setActiveDays] = useState(goal.activeDays?.length ? goal.activeDays : [0,1,2,3,4]);

  useEffect(() => {
    setName(goal.name);
    setBonus(String(goal.bonus || 0));
    setTargetUnits(String(goal.targetUnits || 0));
    setActiveDays(goal.activeDays?.length ? goal.activeDays : [0,1,2,3,4]);
  }, [goal.id]);

  function toggleDay(i) {
    setActiveDays((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort()));
  }

  function save() {
    const n = name.trim();
    if (!n) return;
    if (goal.goalType === "COUNT") {
      const q = Math.floor(Number(targetUnits));
      if (!q || q <= 0) return;
      onUpdateGoal(goal.id, { name: n, bonus: Number(bonus || 0), targetUnits: q });
    } else {
      if (!activeDays.length) return;
      onUpdateGoal(goal.id, { name: n, bonus: Number(bonus || 0), activeDays, targetDays: activeDays.length });
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold">{goal.name}</div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{goalBadge(goal)}</Badge>
            <Badge variant="secondary">{pct}%</Badge>
            <Button variant="secondary" size="sm" onClick={() => onDisableGoal(goal.id)} className="gap-1">
              <Trash2 className="h-4 w-4" /> Desativar
            </Button>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          Feito <span className="font-medium text-slate-900">{done}</span> / Meta{" "}
          <span className="font-medium text-slate-900">{target}</span> • Faltam {remaining}
          {Number(goal.bonus || 0) > 0 ? <span className="text-slate-500"> • Bônus {brl(goal.bonus)}</span> : null}
        </div>
        <Progress value={pct} />

        <Separator />

        <div className="space-y-2">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Bônus ao bater (R$)</Label>
            <Input value={bonus} onChange={(e) => setBonus(e.target.value)} inputMode="decimal" />
          </div>

          {goal.goalType === "COUNT" ? (
            <div className="space-y-1">
              <Label>Meta semanal (quantidade)</Label>
              <Input value={targetUnits} onChange={(e) => setTargetUnits(e.target.value)} inputMode="numeric" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Dias ativos (Seg–Sex)</Label>
              <div className="flex gap-2 flex-wrap">
                {[0,1,2,3,4].map((i) => (
                  <Button
                    key={i}
                    type="button"
                    variant={activeDays.includes(i) ? "default" : "secondary"}
                    onClick={() => toggleDay(i)}
                  >
                    {weekdayLabel(i)}
                  </Button>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                Meta = quantidade de dias ativos.
              </div>
            </div>
          )}

          <Button onClick={save} className="w-full">Salvar ajustes</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- USER ---------------- */

function UserView({ me, store, weekStart, weekEnd, goals, onAddTaskCount, onMarkDoneToday }) {
  const sorted = useMemo(() => {
    const pri = goals.filter((g) => g.priority === "PRIMARY");
    const ext = goals.filter((g) => g.priority === "EXTRA");
    return [...pri, ...ext];
  }, [goals]);

  if (!sorted.length) {
    return (
      <Alert>
        <AlertTitle>Sem metas definidas</AlertTitle>
        <AlertDescription>Peça para o administrador criar suas metas desta semana.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sorted.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            me={me}
            store={store}
            weekStart={weekStart}
            weekEnd={weekEnd}
            onAddTaskCount={onAddTaskCount}
            onMarkDoneToday={onMarkDoneToday}
          />
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="font-semibold">Histórico</div>
              <div className="text-sm text-slate-500">Últimos 50 lançamentos.</div>
            </div>
            <Badge variant="secondary">
              {store.tasks.filter((t) => sorted.some((g) => g.id === t.goalId)).length} itens
            </Badge>
          </div>

          <Separator className="my-4" />

          {store.tasks.filter((t) => sorted.some((g) => g.id === t.goalId)).length === 0 ? (
            <div className="text-sm text-slate-500">Sem registros ainda.</div>
          ) : (
            <div className="space-y-2">
              {store.tasks
                .filter((t) => sorted.some((g) => g.id === t.goalId))
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                .slice(0, 50)
                .map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 p-3 rounded-2xl border bg-white">
                    <div>
                      <div className="font-medium">
                        {sorted.find((g) => g.id === t.goalId)?.name || "Meta"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDT(t.createdAt)} {t.dayDate ? `• Dia: ${t.dayDate}` : ""}
                      </div>
                      {t.note ? <div className="text-xs text-slate-500 mt-1">Obs: {t.note}</div> : null}
                    </div>
                    <Badge className="rounded-full">{t.dayDate ? "✅" : `+${t.qty}`}</Badge>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GoalCard({ goal, me, store, weekStart, weekEnd, onAddTaskCount, onMarkDoneToday }) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const done = useMemo(() => {
    if (goal.goalType === "DAYS") return countDaysDone(store.tasks, goal.id);
    return sumQtyTasks(store.tasks, goal.id);
  }, [store.tasks, goal.id, goal.goalType]);

  const target = goal.goalType === "DAYS" ? (goal.targetDays || 0) : (goal.targetUnits || 0);
  const remaining = Math.max(target - done, 0);
  const pct = clamp(percent(done, target), 0, 100);
  const achieved = target > 0 && done >= target;

  const chartData = useMemo(() => {
    if (!target || target <= 0) return [{ name: "Feito", value: 0 }, { name: "Falta", value: 1 }];
    return [{ name: "Feito", value: Math.max(done, 0) }, { name: "Falta", value: Math.max(remaining, 0) }];
  }, [done, remaining, target]);

  function submitCount(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");
    const q = Math.floor(Number(qty));
    if (!q || q <= 0) return setErr("Informe uma quantidade válida.");
    onAddTaskCount({ userId: me.id, goalId: goal.id, qty: q, note });
    setQty("");
    setNote("");
    setOkMsg("Lançado!");
    setTimeout(() => setOkMsg(""), 900);
  }

  function markToday() {
    setErr("");
    setOkMsg("");
    const result = onMarkDoneToday({ userId: me.id, goalId: goal.id, goal, note });
    if (!result?.ok) return setErr(result?.reason || "Não foi possível marcar hoje.");
    setNote("");
    setOkMsg("Marcado como feito hoje ✅");
    setTimeout(() => setOkMsg(""), 1200);
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-lg">{goal.name}</div>
            <div className="text-sm text-slate-500">
              {goalBadge(goal)} • Semana {weekStart} → {weekEnd}
            </div>
          </div>
          <Badge variant="secondary">{pct}%</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="h-44 md:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" innerRadius={54} outerRadius={78} paddingAngle={2} stroke="none">
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-slate-500">
              Feito <span className="font-semibold text-slate-900">{done}</span> / Meta{" "}
              <span className="font-semibold text-slate-900">{target}</span>
            </div>
            <Progress value={pct} />

            <div className="p-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-200">Faltam</div>
                <div className="text-2xl font-semibold">{remaining}</div>
              </div>
              {achieved ? (
                <Badge className="rounded-full bg-white text-slate-900">Meta batida ✅</Badge>
              ) : null}
            </div>

            {Number(goal.bonus || 0) > 0 ? (
              <div className="text-xs text-slate-500">
                Bônus ao bater: <span className="font-medium text-slate-900">{brl(goal.bonus)}</span>
                {achieved ? <span className="text-slate-500"> • garantido ✅</span> : null}
              </div>
            ) : null}

            {goal.goalType === "DAYS" ? (
              <div className="text-xs text-slate-500">
                Marque <span className="font-medium text-slate-900">HOJE</span> (somente se o admin ativou o dia).
              </div>
            ) : null}
          </div>
        </div>

        {err ? (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}

        {okMsg ? (
          <Alert>
            <AlertTitle>Ok</AlertTitle>
            <AlertDescription>{okMsg}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Observação (opcional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: faltou material, etc" />
          </div>

          {goal.goalType === "DAYS" ? (
            <Button className="w-full gap-2" onClick={markToday}>
              <CheckCircle2 className="h-4 w-4" /> Marcar como FEITO HOJE
            </Button>
          ) : (
            <form onSubmit={submitCount} className="space-y-3">
              <div className="space-y-1">
                <Label>Quantidade</Label>
                <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder="Ex: 25" />
              </div>
              <Button className="w-full">Registrar quantidade</Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------- Dev tests -------- */
function runDevTests() {
  try {
    console.assert(percent(50, 100) === 50, "percent(50,100) deveria ser 50");
    console.assert(clamp(120, 0, 100) === 100, "clamp deveria limitar em 100");
    const d = new Date("2026-02-18T12:00:00");
    const r = getWeekRangeMonFri(d);
    console.assert(r.weekStart && r.weekEnd, "range da semana inválido");
  } catch (e) {
    console.warn("Dev tests falharam:", e);
  }
}
if (typeof import.meta !== "undefined" && import.meta.env?.DEV) runDevTests();
