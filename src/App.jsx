import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { LogOut } from "lucide-react";

const API_BASE = "https://airch-metas-api-production.up.railway.app"; // banco ligado

function apiEnabled() {
  return Boolean(API_BASE);
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("metas_token") || "";
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function getWeekRange(d = new Date()) {
  // Semana SEG–SEX
  const day = d.getDay(); // 0 dom .. 6 sáb
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { weekStart: isoDate(monday), weekEnd: isoDate(friday) };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function percent(done, target) {
  if (!target || target <= 0) return 0;
  return Math.round((done / target) * 100);
}

function formatDT(ts) {
  const d = new Date(ts);
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const COLORS = ["#111827", "#E5E7EB"]; // feito, falta

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return isoDate(d);
}

function weekdayIndexISO(dateStr) {
  // 0=Seg ... 4=Sex
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 dom .. 6 sáb
  const map = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 }; // seg..sex
  return map[day] ?? null;
}

export default function App() {
  const { weekStart, weekEnd } = useMemo(() => getWeekRange(new Date()), []);
  const [session, setSession] = useState(null); // { id, role, name }
  const [me, setMe] = useState(null);

  // Admin data
  const [adminUsers, setAdminUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserGoals, setSelectedUserGoals] = useState([]);

  // User data
  const [myGoals, setMyGoals] = useState([]);
  const [myTasksByGoal, setMyTasksByGoal] = useState({}); // goalId -> tasks[]

  // auto login com token
  useEffect(() => {
    if (!apiEnabled()) return;
    const token = localStorage.getItem("metas_token");
    if (!token) return;
    (async () => {
      try {
        const m = await apiFetch("/api/me");
        setMe(m);
        setSession({ id: m.id, role: m.role, name: m.name });
      } catch {
        localStorage.removeItem("metas_token");
        setMe(null);
        setSession(null);
      }
    })();
  }, []);

  async function logout() {
    localStorage.removeItem("metas_token");
    setMe(null);
    setSession(null);
    setAdminUsers([]);
    setSelectedUserId("");
    setSelectedUserGoals([]);
    setMyGoals([]);
    setMyTasksByGoal({});
  }

  // load data after login
  useEffect(() => {
    if (!session) return;

    (async () => {
      try {
        if (session.role === "ADMIN") {
          const u = await apiFetch("/api/admin/users");
          setAdminUsers(u.rows || []);
        } else {
          await refreshMyData();
        }
      } catch (e) {
        // auth issues
        localStorage.removeItem("metas_token");
        setMe(null);
        setSession(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function refreshMyData() {
    const g = await apiFetch(
      `/api/my/goals?weekStart=${weekStart}&weekEnd=${weekEnd}`
    );
    const goals = g.rows || [];
    setMyGoals(goals);

    // carregar tasks por meta
    const map = {};
    for (const goal of goals) {
      const t = await apiFetch(`/api/my/tasks?goalId=${goal.id}`);
      map[goal.id] = t.rows || [];
    }
    setMyTasksByGoal(map);
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Login
          onLogin={(payload) => {
            setMe({ id: payload.id, role: payload.role, name: payload.name });
            setSession({ id: payload.id, role: payload.role, name: payload.name });
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar
        me={session}
        weekStart={weekStart}
        weekEnd={weekEnd}
        onLogout={logout}
      />

      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        {session.role === "ADMIN" ? (
          <AdminView
            weekStart={weekStart}
            weekEnd={weekEnd}
            users={adminUsers}
            selectedUserId={selectedUserId}
            setSelectedUserId={setSelectedUserId}
            selectedUserGoals={selectedUserGoals}
            setSelectedUserGoals={setSelectedUserGoals}
          />
        ) : (
          <UserView
            weekStart={weekStart}
            weekEnd={weekEnd}
            goals={myGoals}
            tasksByGoal={myTasksByGoal}
            onRefresh={refreshMyData}
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
            className="h-10 object-contain"
          />
          <div>
            <div className="font-semibold">Metas &amp; Produção</div>
            <div className="text-xs text-slate-500">
              Semana: {weekStart} → {weekEnd} (Seg–Sex)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{me.name}</Badge>
          <Button variant="secondary" onClick={onLogout} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      setLoading(true);
      const data = await apiFetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      localStorage.setItem("metas_token", data.token);
      onLogin({ id: data.user.id, role: data.user.role, name: data.user.name });
    } catch {
      setErr("Usuário ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md rounded-2xl shadow-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-col items-center gap-2">
          <img
            src="/logo-airch.png"
            alt="Airch"
            className="h-16 object-contain"
          />
          <div className="text-center">
            <div className="font-semibold text-lg">Entrar</div>
            <div className="text-sm text-slate-500">Sistema de Metas Airch</div>
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
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex: admin"
            />
          </div>
          <div className="space-y-1">
            <Label>Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ex: admin123"
            />
          </div>
          <Button className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
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

function AdminView({
  weekStart,
  weekEnd,
  users,
  selectedUserId,
  setSelectedUserId,
  selectedUserGoals,
  setSelectedUserGoals,
}) {
  const [loadingGoals, setLoadingGoals] = useState(false);

  // form nova meta
  const [goalName, setGoalName] = useState("Montar Kits");
  const [goalType, setGoalType] = useState("COUNT"); // COUNT | DAYS
  const [priority, setPriority] = useState("PRIMARY"); // PRIMARY | EXTRA
  const [targetUnits, setTargetUnits] = useState("200");
  const [days, setDays] = useState([0, 1, 2, 3, 4]); // seg..sex
  const [bonus, setBonus] = useState("0");
  const [msg, setMsg] = useState("");

  async function loadGoals(userId) {
    if (!userId) return;
    try {
      setLoadingGoals(true);
      const data = await apiFetch(
        `/api/admin/goals?userId=${userId}&weekStart=${weekStart}&weekEnd=${weekEnd}`
      );
      setSelectedUserGoals(data.rows || []);
    } finally {
      setLoadingGoals(false);
    }
  }

  useEffect(() => {
    if (!selectedUserId) return;
    loadGoals(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  async function createGoal() {
    setMsg("");
    if (!selectedUserId) {
      setMsg("Selecione um colaborador.");
      return;
    }
    if (!goalName.trim()) {
      setMsg("Informe um nome da meta.");
      return;
    }
    if (goalType === "COUNT") {
      const n = Math.floor(Number(targetUnits));
      if (!n || n <= 0) {
        setMsg("Quantidade inválida.");
        return;
      }
    } else {
      if (!days.length) {
        setMsg("Selecione os dias (Seg–Sex).");
        return;
      }
    }

    await apiFetch("/api/admin/goals", {
      method: "POST",
      body: JSON.stringify({
        userId: Number(selectedUserId),
        weekStart,
        weekEnd,
        name: goalName.trim(),
        goalType,
        priority,
        targetUnits: goalType === "COUNT" ? Number(targetUnits) : 0,
        activeDays: goalType === "DAYS" ? days : [],
        bonus: Number(bonus || 0),
      }),
    });

    setMsg("Meta criada!");
    await loadGoals(selectedUserId);
    setTimeout(() => setMsg(""), 1000);
  }

  const selectedUser = users.find((u) => String(u.id) === String(selectedUserId));

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-semibold text-lg">Painel do Admin</div>
              <div className="text-sm text-slate-500">
                Crie metas (principal e extras) por colaborador.
              </div>
            </div>
            <Badge variant="secondary">
              Semana {weekStart} → {weekEnd}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedUser ? (
                <div className="text-xs text-slate-500">
                  Selecionado: <span className="font-medium">{selectedUser.name}</span>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIMARY">Principal</SelectItem>
                    <SelectItem value="EXTRA">Extra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={goalType} onValueChange={setGoalType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COUNT">Por contagem</SelectItem>
                    <SelectItem value="DAYS">Por dia (Seg–Sex)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome da meta</Label>
              <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Bônus (R$)</Label>
              <Input value={bonus} onChange={(e) => setBonus(e.target.value)} inputMode="numeric" />
            </div>
          </div>

          {goalType === "COUNT" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-2">
                <Label>Quantidade alvo</Label>
                <Input
                  value={targetUnits}
                  onChange={(e) => setTargetUnits(e.target.value)}
                  inputMode="numeric"
                  placeholder="Ex: 250"
                />
              </div>
              <div className="md:col-span-2 text-xs text-slate-500">
                Ex: “Montar Kits” com meta de 200 unidades na semana.
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Meta por dia: o colaborador marca “feito hoje” uma vez por dia.
              (Padrão Seg–Sex)
            </div>
          )}

          <Button onClick={createGoal} disabled={!selectedUserId}>
            Criar meta
          </Button>

          {msg ? <div className="text-sm text-slate-600">{msg}</div> : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-semibold">Metas do colaborador</div>
              <div className="text-sm text-slate-500">
                {selectedUser ? selectedUser.name : "Selecione um colaborador"}
              </div>
            </div>
            {loadingGoals ? <Badge variant="secondary">Carregando…</Badge> : null}
          </div>

          <Separator className="my-4" />

          {!selectedUserId ? (
            <div className="text-sm text-slate-500">Selecione um colaborador acima.</div>
          ) : selectedUserGoals.length === 0 ? (
            <div className="text-sm text-slate-500">
              Nenhuma meta criada ainda para esta semana.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedUserGoals.map((g) => (
                <div key={g.id} className="p-3 rounded-2xl border bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">
                      {g.name}{" "}
                      <span className="text-xs text-slate-500">
                        ({g.priority === "PRIMARY" ? "Principal" : "Extra"})
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {g.goalType === "COUNT" ? `Alvo: ${g.targetUnits}` : "Por dia"}
                    </Badge>
                  </div>
                  {Number(g.bonus) > 0 ? (
                    <div className="text-xs text-slate-500 mt-1">Bônus: R$ {Number(g.bonus).toFixed(2)}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserView({ weekStart, weekEnd, goals, tasksByGoal, onRefresh }) {
  const [err, setErr] = useState("");

  async function addCount(goalId, qty, note) {
    await apiFetch("/api/my/tasks/count", {
      method: "POST",
      body: JSON.stringify({ goalId, qty, note: note || "" }),
    });
    await onRefresh();
  }

  async function markDay(goalId) {
    await apiFetch("/api/my/tasks/day", {
      method: "POST",
      body: JSON.stringify({ goalId, dayDate: todayISO(), note: "" }),
    });
    await onRefresh();
  }

  return (
    <div className="space-y-4">
      {goals.length === 0 ? (
        <Alert>
          <AlertTitle>Sem metas nesta semana</AlertTitle>
          <AlertDescription>
            Peça para o administrador criar suas metas (principal e extras) para {weekStart} → {weekEnd}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            tasks={tasksByGoal[g.id] || []}
            onAddCount={addCount}
            onMarkDay={markDay}
            setErr={setErr}
          />
        ))}
      </div>

      {err ? (
        <Alert variant="destructive">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function GoalCard({ goal, tasks, onAddCount, onMarkDay, setErr }) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const isCount = goal.goalType === "COUNT";

  // progresso
  const doneCount = isCount
    ? tasks.reduce((acc, t) => acc + (Number(t.qty) || 0), 0)
    : 0;

  const doneDaysSet = !isCount
    ? new Set((tasks || []).map((t) => t.dayDate).filter(Boolean))
    : new Set();

  const doneDays = doneDaysSet.size;

  const target = isCount ? Number(goal.targetUnits || 0) : Number(goal.targetDays || 5);
  const done = isCount ? doneCount : doneDays;
  const remaining = Math.max(target - done, 0);
  const pct = percent(done, target);

  const chartData = useMemo(() => {
    if (!target || target <= 0) return [{ name: "Feito", value: 0 }, { name: "Falta", value: 1 }];
    return [{ name: "Feito", value: Math.max(done, 0) }, { name: "Falta", value: Math.max(remaining, 0) }];
  }, [done, remaining, target]);

  async function submitCount(e) {
    e.preventDefault();
    setErr("");

    const q = Math.floor(Number(qty));
    if (!q || q <= 0) {
      setErr("Informe uma quantidade válida.");
      return;
    }
    await onAddCount(goal.id, q, note);
    setQty("");
    setNote("");
  }

  const idx = weekdayIndexISO(todayISO());
  const canMarkToday = idx !== null && idx >= 0 && idx <= 4; // seg..sex
  const alreadyMarkedToday = doneDaysSet.has(todayISO());

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-lg">{goal.name}</div>
            <div className="text-xs text-slate-500">
              {goal.priority === "PRIMARY" ? "Meta principal" : "Meta extra"} •{" "}
              {isCount ? "Por contagem" : "Por dia (Seg–Sex)"}
            </div>
          </div>
          <Badge variant="secondary">{pct}%</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={2}
                  stroke="none"
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-slate-600">
              Feito <span className="font-semibold text-slate-900">{done}</span> /{" "}
              Meta <span className="font-semibold text-slate-900">{target}</span>
              <span className="text-slate-500"> • Faltam {remaining}</span>
            </div>
            <Progress value={clamp(pct, 0, 100)} />
            {Number(goal.bonus) > 0 ? (
              <div className="text-xs text-slate-500">
                Bônus ao bater: <span className="font-medium">R$ {Number(goal.bonus).toFixed(2)}</span>
              </div>
            ) : null}
          </div>
        </div>

        <Separator />

        {isCount ? (
          <form onSubmit={submitCount} className="space-y-3">
            <div className="space-y-1">
              <Label>Adicionar quantidade feita</Label>
              <Input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="numeric"
                placeholder="Ex: 25"
              />
            </div>
            <div className="space-y-1">
              <Label>Observação (opcional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: faltou material, etc"
              />
            </div>
            <Button className="w-full">Registrar</Button>
          </form>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-slate-600">
              Marque “feito hoje” (1 vez por dia). Hoje: <span className="font-medium">{todayISO()}</span>
            </div>
            <Button
              className="w-full"
              variant={alreadyMarkedToday ? "secondary" : "default"}
              disabled={!canMarkToday || alreadyMarkedToday}
              onClick={() => onMarkDay(goal.id)}
            >
              {alreadyMarkedToday ? "Já marcado hoje ✅" : "Marcar como feito hoje"}
            </Button>
            {!canMarkToday ? (
              <div className="text-xs text-slate-500">
                Fora de Seg–Sex não conta para a meta diária.
              </div>
            ) : null}
          </div>
        )}

        <Separator />

        <div>
          <div className="flex items-center justify-between">
            <div className="font-medium">Histórico</div>
            <Badge variant="secondary">{tasks.length}</Badge>
          </div>

          {tasks.length === 0 ? (
            <div className="text-sm text-slate-500 mt-2">Sem registros ainda.</div>
          ) : (
            <div className="space-y-2 mt-2">
              {tasks.slice(0, 20).map((t) => (
                <div key={t.id} className="p-3 rounded-2xl border bg-white flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">
                      {isCount ? `+${t.qty}` : `Dia marcado: ${t.dayDate}`}
                    </div>
                    <div className="text-xs text-slate-500">{formatDT(t.createdAt)}</div>
                    {t.note ? <div className="text-xs text-slate-500 mt-1">Obs: {t.note}</div> : null}
                  </div>
                  <Badge className="rounded-full">{isCount ? `+${t.qty}` : "OK"}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
