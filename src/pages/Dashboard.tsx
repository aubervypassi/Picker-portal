import { AlertTriangle, CalendarDays, GraduationCap, MapPin, MessageSquare, Moon, UserCheck, Users } from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Badge, Button, Card, Stat } from '../components/ui';
import { SHIFT_INFO, addDays, agentShift, fmtDate, fmtTime, lvl, nightPicker, shiftFor, storeAgents } from '../lib/utils';
import type { StoreId } from '../types';

export default function Dashboard({ scope, go }: PageProps) {
  const { db, me } = useDB();
  if (!me) return null;
  const today = new Date();
  const lastPunch = (id: string) => db.punches.filter((p) => p.userId === id).at(-1);

  if (lvl(me) === 1) {
    const s = agentShift(db, me, today).code;
    const s2 = agentShift(db, me, addDays(today, 1)).code;
    const lp = lastPunch(me.id);
    const onSite = lp?.type === 'ENTRÉE';
    const expl = db.explanations.filter((e) => e.userId === me.id && e.status === 'En attente');
    const reqs = db.requests.filter((r) => r.userId === me.id).slice(-3).reverse();
    const todo = db.courses.filter((c) => !db.results.some((r) => r.userId === me.id && r.courseId === c.id && r.passed));
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-500">Bonjour 👋</p>
          <h1 className="text-2xl font-extrabold">{me.name}</h1>
          <p className="text-sm text-gray-500">
            {me.role} • {me.team || '—'} • ID {me.id}
          </p>
        </div>
        {expl.length > 0 && (
          <button onClick={() => go('explications')} className="w-full text-left rounded-2xl bg-red-50 border border-red-200 p-4 flex gap-3">
            <AlertTriangle className="w-6 h-6 text-glovo-red shrink-0" />
            <div>
              <div className="font-bold text-glovo-red">{expl.length} demande(s) d'explication en attente</div>
              <div className="text-sm text-red-700">Vous devez répondre sous 48h. Touchez pour répondre.</div>
            </div>
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="text-xs font-semibold text-gray-500">Aujourd'hui</div>
            <div className="text-xl font-extrabold mt-1">{s ? SHIFT_INFO[s].label : '—'}</div>
            <div className="text-sm text-gray-500">{s ? SHIFT_INFO[s].name : ''}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-gray-500">Demain</div>
            <div className="text-xl font-extrabold mt-1">{s2 ? SHIFT_INFO[s2].label : '—'}</div>
            <div className="text-sm text-gray-500">{s2 ? SHIFT_INFO[s2].name : ''}</div>
          </Card>
        </div>
        <Card className="p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-gray-500">Statut de pointage</div>
            <div className={`font-bold ${onSite ? 'text-glovo-green' : 'text-gray-700'}`}>
              {onSite ? `Sur site depuis ${fmtTime(lp!.at)}` : lp ? `Sorti à ${fmtTime(lp.at)} (${fmtDate(lp.at)})` : 'Aucun pointage'}
            </div>
          </div>
          <Button variant="green" icon={MapPin} onClick={() => go('pointage')}>
            Pointer
          </Button>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold">Formations à valider</div>
            <Badge color={todo.length ? 'yellow' : 'green'}>{todo.length ? `${todo.length} restante(s)` : 'À jour'}</Badge>
          </div>
          {todo.slice(0, 3).map((c) => (
            <div key={c.id} className="text-sm py-1.5 border-t first:border-0 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-glovo-green" /> {c.title}
            </div>
          ))}
          {todo.length > 0 && (
            <Button size="sm" variant="outline" className="mt-2" onClick={() => go('formations')}>
              Commencer
            </Button>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold">Mes dernières requêtes</div>
            <Button size="sm" variant="ghost" icon={MessageSquare} onClick={() => go('requetes')}>
              Nouvelle
            </Button>
          </div>
          {reqs.length === 0 && <div className="text-sm text-gray-400">Aucune requête.</div>}
          {reqs.map((r) => (
            <div key={r.id} className="text-sm py-1.5 border-t first:border-0 flex justify-between gap-2">
              <span className="truncate">{r.message}</span>
              <Badge color={r.status === 'Approuvée' || r.status === 'Reçue' ? 'green' : r.status === 'Refusée' ? 'red' : 'yellow'}>{r.status}</Badge>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // Admin & Lead
  const stores: StoreId[] = scope === 'ALL' ? db.stores.map((s) => s.id) : [scope];
  const agents = stores.flatMap((s) => storeAgents(db, s));
  const active = agents.filter((a) => a.status === 'Actif');
  const onSite = active.filter((a) => lastPunch(a.id)?.type === 'ENTRÉE');
  const ids = new Set(agents.map((a) => a.id));
  const pendingReq = db.requests.filter((r) => ids.has(r.userId) && r.status === 'En attente').length;
  const pendingExpl = db.explanations.filter((e) => ids.has(e.userId) && e.status !== 'Traité').length;
  const totalPairs = active.length * db.courses.length || 1;
  const passed = db.results.filter((r) => r.passed && ids.has(r.userId)).length;
  const train = Math.round((Math.min(passed, totalPairs) / totalPairs) * 100);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-gray-500">{today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1 className="text-2xl font-extrabold">Tableau de bord {scope === 'ALL' ? 'global' : db.stores.find((s) => s.id === scope)?.name}</h1>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Agents actifs" value={active.length} icon={Users} sub={`${agents.length - active.length} suspendu(s)`} />
        <Stat label="Sur site maintenant" value={onSite.length} icon={UserCheck} tone="green" />
        <Stat label="Requêtes en attente" value={pendingReq} icon={MessageSquare} tone={pendingReq ? 'red' : 'gray'} />
        <Stat label="Explications ouvertes" value={pendingExpl} icon={AlertTriangle} tone={pendingExpl ? 'red' : 'gray'} />
        <Stat label="Formations validées" value={`${train}%`} icon={GraduationCap} tone="green" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {stores.map((sid) => {
          const st = db.stores.find((s) => s.id === sid)!;
          const list = storeAgents(db, sid, false);
          const by = (c: string) => list.filter((a) => shiftFor(db, a, today) === c);
          const nightId = by('N')[0]?.id || nightPicker(db, sid, today);
          const night = db.users.find((u) => u.id === nightId);
          return (
            <Card key={sid} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-glovo-green" /> {st.name} — aujourd'hui
                </div>
                <Button size="sm" variant="ghost" onClick={() => go('planning')}>
                  Planning
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {(sid === 'ABJ' ? (['M', 'S', 'H'] as const) : (['M', 'S', 'I'] as const)).map((c) => (
                  <div key={c} className={`rounded-xl border p-2 ${SHIFT_INFO[c].cls}`}>
                    <div className="text-xs font-semibold">{SHIFT_INFO[c].label}</div>
                    <div className="text-xl font-extrabold">{by(c).length}</div>
                    <div className="text-[10px]">{SHIFT_INFO[c].name}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-50 p-3 text-sm">
                <Moon className="w-4 h-4 text-indigo-700" />
                <span>
                  Nuit 0000 - 0800 : <b>{night?.name || 'non assigné'}</b>
                </span>
              </div>
              <div className="mt-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Sur site</div>
                <div className="flex flex-wrap gap-1">
                  {onSite.filter((a) => a.store === sid).length === 0 && <span className="text-xs text-gray-400">Personne n'est pointé.</span>}
                  {onSite
                    .filter((a) => a.store === sid)
                    .map((a) => (
                      <Badge key={a.id} color="green">
                        {a.name}
                      </Badge>
                    ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
