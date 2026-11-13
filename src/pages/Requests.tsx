import { useState } from 'react';
import { CalendarOff, Check, CheckCheck, MessageSquare, MessageSquareText, Send, UserX, X } from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, Stat, Textarea, useUI } from '../components/ui';
import { addDays, fmtDate, fmtDateTime, isManager, managersOf, parseYmd, uid, ymd } from '../lib/utils';
import type { DB, PickerRequest, RequestType } from '../types';

const TYPES: Record<RequestType, { label: string; icon: any; desc: string }> = {
  permission: { label: 'Demande de permission', icon: CalendarOff, desc: 'À valider ou refuser par le Store Manager' },
  absence: { label: "Notification d'absence", icon: UserX, desc: 'Accusé de réception par le Store Manager' },
  commentaire: { label: 'Commentaire', icon: MessageSquareText, desc: 'Suggestion, remarque, problème' },
};

const color = (s: PickerRequest['status']) => (s === 'Approuvée' || s === 'Reçue' || s === 'Lu' ? 'green' : s === 'Refusée' ? 'red' : 'yellow');

/** Marque les jours approuvés comme « Congé/Abs. » dans le planning */
function markPlanning(d: DB, r: PickerRequest) {
  const u = d.users.find((x) => x.id === r.userId);
  if (!u || u.store === 'ALL' || !r.dateFrom) return;
  let cur = parseYmd(r.dateFrom);
  const end = parseYmd(r.dateTo || r.dateFrom);
  for (let i = 0; cur <= end && i < 60; i++, cur = addDays(cur, 1)) {
    const dow = (cur.getDay() + 6) % 7;
    d.planningOverrides[`${u.store}|${ymd(cur)}|${u.id}`] = r.type === 'absence' ? 'A' : 'C';
  }
}

export default function Requests({ scope }: PageProps) {
  const { me: meMaybe } = useDB();
  return isManager(meMaybe) ? <AdminView scope={scope} /> : <AgentView />;
}

function AgentView() {
  const { db, me, update, notify } = useDB();
  const ui = useUI();
  const [type, setType] = useState<RequestType>('permission');
  const today = ymd(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [msg, setMsg] = useState('');
  const mine = db.requests.filter((r) => r.userId === me!.id).slice().reverse();
  const adminIds = managersOf(db, me!.store);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (msg.trim().length < 3) return ui.toast('Ajoutez un message', 'err');
    if (type !== 'commentaire' && to < from) return ui.toast('La date de fin doit être après la date de début', 'err');
    update((d) => {
      d.requests.push({
        id: uid('r'),
        userId: me!.id,
        type,
        dateFrom: type !== 'commentaire' ? from : undefined,
        dateTo: type !== 'commentaire' ? to : undefined,
        message: msg.trim(),
        createdAt: new Date().toISOString(),
        status: 'En attente',
      });
    });
    notify(adminIds, `📨 ${me!.name} : ${TYPES[type].label.toLowerCase()}.`);
    setMsg('');
    ui.toast('Requête envoyée');
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Mes requêtes" subtitle="Permissions, absences et commentaires" icon={MessageSquare} />
      <Card className="p-4 mb-5">
        <form onSubmit={send} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TYPES) as RequestType[]).map((t) => {
              const T = TYPES[t];
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-xl border p-3 text-left text-xs ${type === t ? 'border-glovo-green bg-emerald-50 ring-1 ring-glovo-green' : 'hover:bg-gray-50'}`}
                >
                  <T.icon className={`w-5 h-5 mb-1 ${type === t ? 'text-glovo-green' : 'text-gray-500'}`} />
                  <div className="font-bold">{T.label}</div>
                  <div className="text-gray-500 hidden sm:block">{T.desc}</div>
                </button>
              );
            })}
          </div>
          {type !== 'commentaire' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Du">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="Au">
                <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
          )}
          <Field label={type === 'commentaire' ? 'Votre commentaire' : 'Motif'}>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={type === 'absence' ? 'ex. Malade, certificat médical à suivre' : ''} />
          </Field>
          <Button type="submit" variant="green" icon={Send} className="w-full">
            Envoyer
          </Button>
        </form>
      </Card>
      <div className="font-bold mb-2">Historique</div>
      <div className="space-y-2">
        {mine.length === 0 && (
          <Card>
            <Empty text="Aucune requête envoyée." />
          </Card>
        )}
        {mine.map((r) => (
          <Card key={r.id} className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sm">{TYPES[r.type].label}</div>
              <Badge color={color(r.status)}>{r.status}</Badge>
            </div>
            {r.dateFrom && (
              <div className="text-xs text-gray-500">
                {fmtDate(r.dateFrom)}
                {r.dateTo && r.dateTo !== r.dateFrom && ` → ${fmtDate(r.dateTo)}`}
              </div>
            )}
            <p className="text-sm mt-1">{r.message}</p>
            {r.adminNote && <p className="text-xs mt-1 bg-gray-50 rounded-lg p-2">Réponse : {r.adminNote}</p>}
            <div className="text-[11px] text-gray-400 mt-1">Envoyée le {fmtDateTime(r.createdAt)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdminView({ scope }: { scope: PageProps['scope'] }) {
  const { db, update, notify } = useDB();
  const ui = useUI();
  const [type, setType] = useState<'ALL' | RequestType>('ALL');
  const [status, setStatus] = useState<'ALL' | 'En attente' | 'done'>('En attente');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const ids = new Set(db.users.filter((u) => scope === 'ALL' || u.store === scope).map((u) => u.id));
  const all = db.requests.filter((r) => ids.has(r.userId));
  const list = all
    .filter((r) => type === 'ALL' || r.type === type)
    .filter((r) => status === 'ALL' || (status === 'done' ? r.status !== 'En attente' : r.status === 'En attente'))
    .slice()
    .reverse();
  const userOf = (id: string) => db.users.find((u) => u.id === id);

  const act = (r: PickerRequest, s: PickerRequest['status']) => {
    update((d) => {
      const x = d.requests.find((y) => y.id === r.id)!;
      x.status = s;
      x.adminNote = (notes[r.id] || '').trim() || undefined;
      x.updatedAt = new Date().toISOString();
      if (r.type === 'permission' && s === 'Approuvée') markPlanning(d, r);
      if (r.type === 'absence' && s === 'Reçue') markPlanning(d, r);
    });
    notify([r.userId], `Votre ${TYPES[r.type].label.toLowerCase()} : ${s}.${notes[r.id] ? ' ' + notes[r.id] : ''}`);
    ui.toast(`Requête ${s.toLowerCase()}`);
  };

  return (
    <div>
      <PageHeader title="Pickers Request" subtitle="Tableau de bord consolidé des requêtes" icon={MessageSquare} />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Permissions en attente" value={all.filter((r) => r.type === 'permission' && r.status === 'En attente').length} icon={CalendarOff} tone="yellow" />
        <Stat label="Absences à accuser" value={all.filter((r) => r.type === 'absence' && r.status === 'En attente').length} icon={UserX} tone="red" />
        <Stat label="Commentaires non lus" value={all.filter((r) => r.type === 'commentaire' && r.status === 'En attente').length} icon={MessageSquareText} tone="gray" />
      </div>
      <Card className="p-3 mb-4 grid grid-cols-2 gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="ALL">Tous les types</option>
          {(Object.keys(TYPES) as RequestType[]).map((t) => (
            <option key={t} value={t}>
              {TYPES[t].label}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="En attente">En attente</option>
          <option value="done">Traitées</option>
          <option value="ALL">Toutes</option>
        </Select>
      </Card>
      <div className="space-y-3">
        {list.length === 0 && (
          <Card>
            <Empty text="Aucune requête pour ces filtres." />
          </Card>
        )}
        {list.map((r) => {
          const u = userOf(r.userId);
          const T = TYPES[r.type];
          return (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-glovo-yellow/40 flex items-center justify-center shrink-0">
                    <T.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold">{u?.name || r.userId}</div>
                    <div className="text-xs text-gray-500">
                      {T.label} • {u?.role} • {db.stores.find((s) => s.id === u?.store)?.name}
                    </div>
                  </div>
                </div>
                <Badge color={color(r.status)}>{r.status}</Badge>
              </div>
              {r.dateFrom && (
                <div className="text-sm font-semibold mt-2">
                  {fmtDate(r.dateFrom)}
                  {r.dateTo && r.dateTo !== r.dateFrom && ` → ${fmtDate(r.dateTo)}`}
                </div>
              )}
              <p className="text-sm mt-1">{r.message}</p>
              <div className="text-[11px] text-gray-400 mt-1">Reçue le {fmtDateTime(r.createdAt)}</div>
              {r.status === 'En attente' ? (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <Input placeholder="Note pour l'agent (facultatif)" value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                  <div className="flex gap-2 shrink-0">
                    {r.type === 'permission' && (
                      <>
                        <Button size="sm" variant="green" icon={Check} onClick={() => act(r, 'Approuvée')}>
                          Valider
                        </Button>
                        <Button size="sm" variant="danger" icon={X} onClick={() => act(r, 'Refusée')}>
                          Refuser
                        </Button>
                      </>
                    )}
                    {r.type === 'absence' && (
                      <Button size="sm" variant="green" icon={CheckCheck} onClick={() => act(r, 'Reçue')}>
                        Accuser réception
                      </Button>
                    )}
                    {r.type === 'commentaire' && (
                      <Button size="sm" variant="outline" icon={CheckCheck} onClick={() => act(r, 'Lu')}>
                        Marquer lu
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                r.adminNote && <p className="text-xs mt-2 bg-gray-50 rounded-lg p-2">Note : {r.adminNote}</p>
              )}
            </Card>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Une permission validée ou une absence reçue passe automatiquement les jours concernés en « Congés » (permission) ou « Absent » (absence) dans le planning.</p>
    </div>
  );
}
