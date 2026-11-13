import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Gavel, Plus, Send } from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Select, Textarea, useUI } from '../components/ui';
import { fmtDateTime, isManager, isStaff, managersOf, uid } from '../lib/utils';
import type { Explanation } from '../types';

const MOTIFS = ['Retard', 'Absence non justifiée', 'Erreur de picking', 'Commande oubliée', 'Non-respect des procédures', 'Comportement', 'Pointage irrégulier', 'Autre'];
const DECISIONS = ['Justification acceptée', 'Classé sans suite', 'Rappel à l’ordre', 'Avertissement écrit', 'Mise à pied', 'Transmis aux RH'];
const H48 = 48 * 3600 * 1000;

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Countdown({ e, now }: { e: Explanation; now: number }) {
  if (e.status !== 'En attente') return null;
  const left = new Date(e.deadline).getTime() - now;
  if (left <= 0) return <Badge color="red">Délai de 48h dépassé</Badge>;
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const urgent = left < 6 * 3600000;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm font-bold px-2 py-0.5 rounded-lg ${urgent ? 'bg-red-100 text-glovo-red' : 'bg-amber-100 text-amber-900'}`}>
      <Clock className="w-3.5 h-3.5" />
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

const statusBadge = (e: Explanation, now: number) =>
  e.status === 'Traité' ? (
    <Badge color="green">Traité</Badge>
  ) : e.status === 'Répondu' ? (
    <Badge color="blue">Réponse reçue</Badge>
  ) : now > new Date(e.deadline).getTime() ? (
    <Badge color="red">Sans réponse</Badge>
  ) : (
    <Badge color="yellow">En attente</Badge>
  );

export default function Explications({ scope }: PageProps) {
  const { me: meMaybe } = useDB();
  const me = meMaybe!;
  return isManager(me) ? <AdminView scope={scope} /> : <AgentView />;
}

function AgentView() {
  const { db, me, update, notify } = useDB();
  const ui = useUI();
  const now = useNow();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const mine = db.explanations.filter((e) => e.userId === me!.id).slice().reverse();
  const adminIds = managersOf(db, me!.store);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Demandes d'explication" subtitle="Réponse obligatoire sous 48 heures" icon={AlertTriangle} />
      {mine.length === 0 && (
        <Card>
          <Empty icon={CheckCircle2} text="Aucune demande d'explication. Continuez comme ça !" />
        </Card>
      )}
      <div className="space-y-3">
        {mine.map((e) => {
          const expired = now > new Date(e.deadline).getTime();
          return (
            <Card key={e.id} className={`p-4 ${e.status === 'En attente' && !expired ? 'border-glovo-red' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold">{e.motif}</div>
                <div className="flex items-center gap-2">
                  <Countdown e={e} now={now} />
                  {statusBadge(e, now)}
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Émise le {fmtDateTime(e.createdAt)} • échéance {fmtDateTime(e.deadline)}</div>
              <p className="text-sm text-gray-700 mt-2 bg-gray-50 rounded-xl p-3 whitespace-pre-line">{e.details}</p>
              {e.status === 'En attente' && !expired && (
                <div className="mt-3 space-y-2">
                  <Textarea placeholder="Votre explication…" rows={4} value={draft[e.id] || ''} onChange={(ev) => setDraft({ ...draft, [e.id]: ev.target.value })} />
                  <Button
                    variant="green"
                    icon={Send}
                    disabled={(draft[e.id] || '').trim().length < 10}
                    onClick={() => {
                      update((d) => {
                        const x = d.explanations.find((y) => y.id === e.id)!;
                        x.response = draft[e.id].trim();
                        x.respondedAt = new Date().toISOString();
                        x.status = 'Répondu';
                      });
                      notify(adminIds, `✉️ ${me!.name} a répondu à la demande d'explication « ${e.motif} ».`);
                      ui.toast('Réponse envoyée');
                    }}
                  >
                    Envoyer ma réponse
                  </Button>
                  <p className="text-[11px] text-gray-400">10 caractères minimum. Une fois envoyée, la réponse ne peut plus être modifiée.</p>
                </div>
              )}
              {e.status === 'En attente' && expired && <p className="text-sm text-glovo-red mt-3">Le délai de 48h est dépassé. Rapprochez-vous de votre Store Manager.</p>}
              {e.response && (
                <div className="mt-3 text-sm">
                  <div className="text-xs font-semibold text-gray-500">Ma réponse ({fmtDateTime(e.respondedAt!)})</div>
                  <p className="whitespace-pre-line">{e.response}</p>
                </div>
              )}
              {e.status === 'Traité' && (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm">
                  <div className="font-bold text-glovo-green flex items-center gap-1">
                    <Gavel className="w-4 h-4" /> Décision : {e.decision}
                  </div>
                  {e.adminComment && <p className="mt-1">{e.adminComment}</p>}
                  <div className="text-[11px] text-gray-500 mt-1">Traité le {fmtDateTime(e.treatedAt!)}</div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AdminView({ scope }: { scope: PageProps['scope'] }) {
  const { db, update, notify } = useDB();
  const ui = useUI();
  const now = useNow();
  const agents = db.users.filter((u) => isStaff(u) && (scope === 'ALL' || u.store === scope)).sort((a, b) => a.name.localeCompare(b.name));
  const [form, setForm] = useState<{ userId: string; motif: string; details: string } | null>(null);
  const [treat, setTreat] = useState<Explanation | null>(null);
  const [decision, setDecision] = useState(DECISIONS[0]);
  const [comment, setComment] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'open' | 'Traité'>('open');
  const ids = new Set(agents.map((a) => a.id));
  const list = db.explanations
    .filter((e) => ids.has(e.userId))
    .filter((e) => filter === 'ALL' || (filter === 'open' ? e.status !== 'Traité' : e.status === 'Traité'))
    .slice()
    .reverse();
  const nameOf = (id: string) => db.users.find((u) => u.id === id)?.name || id;

  return (
    <div>
      <PageHeader
        title="Demandes d'explication"
        subtitle="Émission, suivi du délai de 48h et traitement"
        icon={AlertTriangle}
        actions={
          <Button icon={Plus} onClick={() => setForm({ userId: agents[0]?.id || '', motif: MOTIFS[0], details: '' })}>
            Nouvelle demande
          </Button>
        }
      />
      <div className="inline-flex rounded-xl bg-white border p-1 mb-4">
        {(
          [
            ['open', 'En cours'],
            ['Traité', 'Traitées'],
            ['ALL', 'Toutes'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${filter === k ? 'bg-glovo-yellow' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {list.length === 0 && (
          <Card>
            <Empty text="Aucune demande d'explication." />
          </Card>
        )}
        {list.map((e) => (
          <Card key={e.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-bold">
                  {nameOf(e.userId)} <span className="text-xs font-normal text-gray-400">ID {e.userId}</span>
                </div>
                <div className="text-sm font-semibold text-glovo-red">{e.motif}</div>
              </div>
              <div className="flex items-center gap-2">
                <Countdown e={e} now={now} />
                {statusBadge(e, now)}
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">{e.details}</p>
            <div className="text-xs text-gray-400 mt-1">Émise le {fmtDateTime(e.createdAt)}</div>
            {e.response && (
              <div className="mt-3 rounded-xl bg-sky-50 p-3 text-sm">
                <div className="text-xs font-semibold text-sky-800">Réponse de l'agent — {fmtDateTime(e.respondedAt!)}</div>
                <p className="whitespace-pre-line">{e.response}</p>
              </div>
            )}
            {e.status === 'Traité' ? (
              <div className="mt-2 text-sm text-glovo-green font-semibold">
                Décision : {e.decision} {e.adminComment && <span className="font-normal text-gray-600">— {e.adminComment}</span>}
              </div>
            ) : (
              <Button
                size="sm"
                variant={e.status === 'Répondu' ? 'green' : 'outline'}
                icon={Gavel}
                className="mt-3"
                onClick={() => {
                  setTreat(e);
                  setDecision(DECISIONS[0]);
                  setComment('');
                }}
              >
                Traiter
              </Button>
            )}
          </Card>
        ))}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title="Nouvelle demande d'explication">
        {form && (
          <div className="space-y-3">
            <Field label="Agent concerné">
              <Select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.id}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Motif">
              <Select value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })}>
                {MOTIFS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Faits reprochés (date, heure, circonstances)">
              <Textarea rows={4} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
            </Field>
            <div className="text-xs text-gray-500 bg-amber-50 rounded-xl p-2">L'agent disposera de 48 heures à compter de l'envoi pour répondre.</div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>
                Annuler
              </Button>
              <Button
                variant="green"
                icon={Send}
                disabled={!form.userId || form.details.trim().length < 5}
                onClick={() => {
                  const created = new Date();
                  update((d) => {
                    d.explanations.push({
                      id: uid('e'),
                      userId: form.userId,
                      motif: form.motif,
                      details: form.details.trim(),
                      createdAt: created.toISOString(),
                      deadline: new Date(created.getTime() + H48).toISOString(),
                      status: 'En attente',
                    });
                  });
                  notify([form.userId], `⚠️ Demande d'explication : « ${form.motif} ». Vous avez 48h pour répondre.`);
                  ui.toast('Demande envoyée — compte à rebours de 48h lancé');
                  setForm(null);
                }}
              >
                Émettre
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!treat} onClose={() => setTreat(null)} title={`Traiter — ${treat ? nameOf(treat.userId) : ''}`}>
        {treat && (
          <div className="space-y-3">
            {!treat.response && <div className="text-xs text-glovo-red bg-red-50 rounded-xl p-2">L'agent n'a pas encore répondu.</div>}
            <Field label="Décision">
              <Select value={decision} onChange={(e) => setDecision(e.target.value)}>
                {DECISIONS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
            <Field label="Commentaire visible par l'agent">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTreat(null)}>
                Annuler
              </Button>
              <Button
                variant="green"
                onClick={() => {
                  update((d) => {
                    const x = d.explanations.find((y) => y.id === treat.id)!;
                    x.status = 'Traité';
                    x.decision = decision;
                    x.adminComment = comment.trim();
                    x.treatedAt = new Date().toISOString();
                  });
                  notify([treat.userId], `✅ Votre demande d'explication « ${treat.motif} » a été traitée : ${decision}.`);
                  ui.toast('Décision enregistrée et visible par l’agent');
                  setTreat(null);
                }}
              >
                Valider
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
