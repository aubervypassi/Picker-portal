import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ClipboardCheck, Eye, Pencil, Plus, Printer, RotateCcw, Send, Star, Trash2 } from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Textarea, useConfirm, useUI } from '../components/ui';
import { SHIFT_INFO, fmtDate, fmtDateTime, isManager, isSuper, managersOf, shiftFor, storeAgents, uid, ymd, parseYmd } from '../lib/utils';
import { DEFAULT_TEMPLATE } from '../data/seed';
import type { QuestionType, ReportQuestion, ShiftCode, ShiftReport, StoreId } from '../types';

const TYPE_LABEL: Record<QuestionType, string> = {
  ouinon: 'Oui / Non',
  texte: 'Texte libre',
  nombre: 'Nombre',
  choix: 'Liste de choix',
  note: 'Note de 1 à 5',
  presence: "Présence de l'équipe",
};

const visible = (q: ReportQuestion, answers: Record<string, any>) => {
  if (!q.cond) return true;
  const v = answers[q.cond.q];
  if (q.cond.v === '> 0') return Number(v) > 0;
  return String(v ?? '') === q.cond.v;
};

export default function ShiftReports({ scope }: PageProps) {
  const { me: meMaybe } = useDB();
  const admin = isSuper(meMaybe);
  const [tab, setTab] = useState<'nouveau' | 'historique' | 'constructeur'>('nouveau');
  const tabs = [
    ['nouveau', 'Nouveau rapport'],
    ['historique', 'Historique'],
    ...(admin ? [['constructeur', 'Constructeur de formulaire']] : []),
  ] as [typeof tab, string][];
  return (
    <div>
      <PageHeader title="Rapport de shift" subtitle="Checklist de fin de shift — Picker Lead & Admin" icon={ClipboardCheck} />
      <div className="inline-flex flex-wrap rounded-xl bg-white border p-1 mb-4">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === k ? 'bg-glovo-yellow' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'nouveau' && <NewReport scope={scope} onDone={() => setTab('historique')} />}
      {tab === 'historique' && <History scope={scope} />}
      {tab === 'constructeur' && admin && <Builder />}
    </div>
  );
}

/* ============ Saisie ============ */
function NewReport({ scope, onDone }: { scope: PageProps['scope']; onDone: () => void }) {
  const { db, me, update, notify } = useDB();
  const ui = useUI();
  const admin = scope === 'ALL';
  const [store, setStore] = useState<StoreId>(scope === 'ALL' ? 'ABN' : scope);
  const [date, setDate] = useState(ymd(new Date()));
  const h = new Date().getHours();
  const [shift, setShift] = useState<ShiftCode>(me!.team === 'Inbound' ? 'I' : me!.role === 'Picker Hub' ? 'H' : h < 8 ? 'N' : h < 16 ? 'M' : 'S');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const team = useMemo(() => storeAgents(db, store, false).filter((a) => shiftFor(db, a, parseYmd(date)) === shift), [db, store, date, shift]);
  const set = (k: string, v: any) => setAnswers((a) => ({ ...a, [k]: v }));

  const submit = () => {
    const missing = db.reportTemplate
      .filter((q) => q.required && visible(q, answers))
      .filter((q) => {
        const v = answers[q.id];
        if (q.type === 'presence') return team.some((m) => v?.[m.id]?.present === false && !v?.[m.id]?.motif?.trim());
        return v === undefined || v === '' || v === null;
      })
      .map((q) => q.id);
    setErrors(missing);
    if (missing.length) return ui.toast(`${missing.length} champ(s) obligatoire(s) manquant(s)`, 'err');
    // présence par défaut = présent
    const pres: Record<string, any> = {};
    team.forEach((m) => (pres[m.id] = answers.presence?.[m.id] || { present: true }));
    const presenceQ = db.reportTemplate.find((q) => q.type === 'presence');
    const final = { ...answers, ...(presenceQ ? { [presenceQ.id]: pres } : {}) };
    update((d) => {
      d.reports.push({ id: uid('rp'), store, authorId: me!.id, date, shift, answers: final, createdAt: new Date().toISOString() });
    });
    notify(
      managersOf(db, store),
      `📋 Rapport de shift ${SHIFT_INFO[shift as Exclude<ShiftCode, ''>]?.label} du ${fmtDate(date)} envoyé par ${me!.name}.`,
    );
    ui.toast('Rapport envoyé');
    setAnswers({});
    onDone();
  };

  return (
    <div className="max-w-2xl space-y-3">
      <Card className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Store">
          <Select value={store} disabled={!admin} onChange={(e) => setStore(e.target.value as StoreId)}>
            {db.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Shift">
          <Select value={shift} onChange={(e) => setShift(e.target.value as ShiftCode)}>
            {(['M', 'S', 'N', 'H', 'I'] as const).map((c) => (
              <option key={c} value={c}>
                {SHIFT_INFO[c].label} ({SHIFT_INFO[c].name})
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {db.reportTemplate
        .filter((q) => visible(q, answers))
        .map((q) => (
          <Card key={q.id} className={`p-4 ${errors.includes(q.id) ? 'border-glovo-red' : ''} ${q.cond ? 'ml-4 border-l-4 border-l-glovo-yellow' : ''}`}>
            <div className="font-semibold text-sm mb-2">
              {q.label} {q.required && <span className="text-glovo-red">*</span>}
            </div>
            {q.type === 'ouinon' && (
              <div className="grid grid-cols-2 gap-2">
                {['Oui', 'Non'].map((v) => (
                  <button
                    key={v}
                    onClick={() => set(q.id, v)}
                    className={`rounded-xl border py-2 font-semibold text-sm ${answers[q.id] === v ? (v === 'Oui' ? 'bg-glovo-green text-white border-glovo-green' : 'bg-glovo-red text-white border-glovo-red') : 'hover:bg-gray-50'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
            {q.type === 'texte' && <Textarea value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} />}
            {q.type === 'nombre' && <Input type="number" min={0} value={answers[q.id] ?? ''} onChange={(e) => set(q.id, e.target.value === '' ? '' : Number(e.target.value))} />}
            {q.type === 'choix' && (
              <Select value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)}>
                <option value="">— Choisir —</option>
                {(q.options || []).map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            )}
            {q.type === 'note' && (
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => set(q.id, n)} aria-label={`${n}/5`}>
                    <Star className={`w-8 h-8 ${(answers[q.id] || 0) >= n ? 'fill-glovo-yellow text-glovo-yellow' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            )}
            {q.type === 'presence' && (
              <div className="space-y-2">
                {team.length === 0 && <div className="text-sm text-gray-400">Aucun agent planifié sur ce shift.</div>}
                {team.map((m) => {
                  const v = answers[q.id]?.[m.id] || { present: true };
                  const setP = (patch: any) => set(q.id, { ...(answers[q.id] || {}), [m.id]: { ...v, ...patch } });
                  return (
                    <div key={m.id} className="rounded-xl border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm">
                          <div className="font-semibold">{m.name}</div>
                          <div className="text-[11px] text-gray-400">{m.role}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant={v.present ? 'green' : 'outline'} onClick={() => setP({ present: true, motif: '' })}>
                            Présent
                          </Button>
                          <Button size="sm" variant={!v.present ? 'danger' : 'outline'} onClick={() => setP({ present: false })}>
                            Absent
                          </Button>
                        </div>
                      </div>
                      {!v.present && <Input className="mt-2" placeholder="Motif de l'absence (obligatoire)" value={v.motif || ''} onChange={(e) => setP({ motif: e.target.value })} />}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      <Button variant="green" size="lg" icon={Send} className="w-full" onClick={submit}>
        Envoyer le rapport
      </Button>
    </div>
  );
}

/* ============ Historique ============ */
function History({ scope }: { scope: PageProps['scope'] }) {
  const { db, me } = useDB();
  const ui = useUI();
  const [view, setView] = useState<ShiftReport | null>(null);
  const list = db.reports
    .filter((r) => scope === 'ALL' || r.store === scope)
    .slice()
    .reverse();
  const nameOf = (id: string) => db.users.find((u) => u.id === id)?.name || id;
  const qOf = (id: string) => db.reportTemplate.find((q) => q.id === id);

  const alerts = (r: ShiftReport) => {
    const a: string[] = [];
    Object.entries(r.answers).forEach(([k, v]) => {
      const q = qOf(k);
      if (q?.type === 'ouinon' && v === 'Non') a.push(q.label.replace(/\?$/, '').slice(0, 30));
      if (q?.type === 'presence') {
        const abs = Object.values(v as any).filter((x: any) => !x.present).length;
        if (abs) a.push(`${abs} absent(s)`);
      }
    });
    if (Number(r.answers.oublis) > 0) a.push(`${r.answers.oublis} commande(s) oubliée(s)`);
    return a;
  };

  const renderVal = (k: string, v: any) => {
    const q = qOf(k);
    if (q?.type === 'presence')
      return (
        <ul className="text-sm">
          {Object.entries(v as Record<string, any>).map(([uid, p]) => (
            <li key={uid}>
              {p.present ? '✅' : '❌'} {nameOf(uid)} {!p.present && <i className="text-glovo-red">— {p.motif}</i>}
            </li>
          ))}
        </ul>
      );
    if (q?.type === 'note') return '★'.repeat(Number(v)) + '☆'.repeat(5 - Number(v));
    return String(v);
  };

  return (
    <div>
      <div className="space-y-3">
        {list.length === 0 && (
          <Card>
            <Empty text="Aucun rapport de shift." />
          </Card>
        )}
        {list.map((r) => {
          const a = alerts(r);
          return (
            <Card key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold">
                  {fmtDate(r.date)} — {SHIFT_INFO[r.shift as Exclude<ShiftCode, ''>]?.label} ({SHIFT_INFO[r.shift as Exclude<ShiftCode, ''>]?.name})
                </div>
                <div className="text-xs text-gray-500">
                  {db.stores.find((s) => s.id === r.store)?.name} • par {nameOf(r.authorId)} • {fmtDateTime(r.createdAt)}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {a.length ? a.map((x) => <Badge key={x} color="red">{x}</Badge>) : <Badge color="green">RAS</Badge>}
                </div>
              </div>
              <Button size="sm" variant="outline" icon={Eye} onClick={() => setView(r)}>
                Voir
              </Button>
            </Card>
          );
        })}
      </div>
      <Modal open={!!view} onClose={() => setView(null)} title="Rapport de shift" wide>
        {view && (
          <div className="print-area">
            <div className="mb-3">
              <div className="font-extrabold text-lg">
                {db.stores.find((s) => s.id === view.store)?.name} — {fmtDate(view.date)} — {SHIFT_INFO[view.shift as Exclude<ShiftCode, ''>]?.label}
              </div>
              <div className="text-xs text-gray-500">
                Rédigé par {nameOf(view.authorId)} le {fmtDateTime(view.createdAt)}
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(view.answers).map(([k, v]) => (
                  <tr key={k} className="border-t align-top">
                    <td className="py-2 pr-3 text-gray-500 w-1/2">{qOf(k)?.label || k}</td>
                    <td className="py-2 font-semibold">{renderVal(k, v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-4 no-print">
              <Button variant="outline" icon={Printer} onClick={() => ui.printPage(`Rapport de shift ${view.date}`)}>
                Exporter PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============ Constructeur (Admin) ============ */
function Builder() {
  const { db, update } = useDB();
  const ui = useUI();
  const { confirm, node } = useConfirm();
  const [edit, setEdit] = useState<ReportQuestion | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [opts, setOpts] = useState('');
  const t = db.reportTemplate;

  const move = (i: number, dir: -1 | 1) =>
    update((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.reportTemplate.length) return;
      [d.reportTemplate[i], d.reportTemplate[j]] = [d.reportTemplate[j], d.reportTemplate[i]];
    });

  const save = () => {
    if (!edit || !edit.label.trim()) return ui.toast('Libellé obligatoire', 'err');
    const q: ReportQuestion = { ...edit, label: edit.label.trim(), options: edit.type === 'choix' ? opts.split(',').map((o) => o.trim()).filter(Boolean) : undefined };
    if (q.cond && !q.cond.q) delete q.cond;
    update((d) => {
      const i = d.reportTemplate.findIndex((x) => x.id === q.id);
      if (i >= 0) d.reportTemplate[i] = q;
      else d.reportTemplate.push(q);
    });
    setEdit(null);
    ui.toast('Question enregistrée');
  };

  const condTarget = edit?.cond ? t.find((q) => q.id === edit.cond!.q) : undefined;

  return (
    <div className="max-w-3xl">
      {node}
      <div className="flex gap-2 mb-3">
        <Button
          icon={Plus}
          onClick={() => {
            setIsNew(true);
            setOpts('');
            setEdit({ id: uid('q'), label: '', type: 'ouinon', required: true });
          }}
        >
          Ajouter une question
        </Button>
        <Button
          variant="outline"
          icon={RotateCcw}
          onClick={() =>
            confirm('Restaurer le formulaire par défaut ? Les questions personnalisées seront supprimées.', () =>
              update((d) => {
                d.reportTemplate = DEFAULT_TEMPLATE;
              }),
            )
          }
        >
          Formulaire par défaut
        </Button>
      </div>
      <div className="space-y-2">
        {t.map((q, i) => (
          <Card key={q.id} className={`p-3 flex items-center gap-3 ${q.cond ? 'ml-6' : ''}`}>
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-20" aria-label="Monter">
                <ArrowUp className="w-4 h-4" />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === t.length - 1} className="disabled:opacity-20" aria-label="Descendre">
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{q.label}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge color="blue">{TYPE_LABEL[q.type]}</Badge>
                {q.required && <Badge color="red">Obligatoire</Badge>}
                {q.cond && (
                  <Badge color="yellow">
                    Si « {t.find((x) => x.id === q.cond!.q)?.label.slice(0, 25)}… » = {q.cond.v}
                  </Badge>
                )}
              </div>
            </div>
            <button
              className="p-1.5 rounded-lg hover:bg-gray-100"
              onClick={() => {
                setIsNew(false);
                setOpts((q.options || []).join(', '));
                setEdit({ ...q });
              }}
              aria-label="Modifier"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded-lg hover:bg-red-50 text-glovo-red"
              onClick={() =>
                confirm(`Supprimer la question « ${q.label} » ?`, () =>
                  update((d) => {
                    d.reportTemplate = d.reportTemplate.filter((x) => x.id !== q.id).map((x) => (x.cond?.q === q.id ? { ...x, cond: undefined } : x));
                  }),
                )
              }
              aria-label="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Card>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={isNew ? 'Nouvelle question' : 'Modifier la question'}>
        {edit && (
          <div className="space-y-3">
            <Field label="Libellé">
              <Input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
            </Field>
            <Field label="Type de réponse">
              <Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as QuestionType })}>
                {(Object.keys(TYPE_LABEL) as QuestionType[]).map((k) => (
                  <option key={k} value={k}>
                    {TYPE_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            {edit.type === 'choix' && (
              <Field label="Options (séparées par des virgules)">
                <Input value={opts} onChange={(e) => setOpts(e.target.value)} />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.required} onChange={(e) => setEdit({ ...edit, required: e.target.checked })} className="accent-[#00A082] w-4 h-4" />
              Réponse obligatoire
            </label>
            <div className="rounded-xl bg-gray-50 p-3 space-y-2">
              <div className="text-xs font-semibold text-gray-600">Affichage conditionnel (facultatif)</div>
              <Select
                value={edit.cond?.q || ''}
                onChange={(e) => {
                  const target = t.find((x) => x.id === e.target.value);
                  setEdit({
                    ...edit,
                    cond: e.target.value ? { q: e.target.value, v: target?.type === 'nombre' ? '> 0' : target?.type === 'ouinon' ? 'Non' : target?.options?.[0] || '' } : undefined,
                  });
                }}
              >
                <option value="">Toujours afficher</option>
                {t
                  .filter((x) => x.id !== edit.id && ['ouinon', 'nombre', 'choix'].includes(x.type))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      Si : {x.label.slice(0, 50)}
                    </option>
                  ))}
              </Select>
              {condTarget && condTarget.type !== 'nombre' && (
                <Select value={edit.cond!.v} onChange={(e) => setEdit({ ...edit, cond: { q: edit.cond!.q, v: e.target.value } })}>
                  {(condTarget.type === 'ouinon' ? ['Oui', 'Non'] : condTarget.options || []).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              )}
              {condTarget?.type === 'nombre' && <div className="text-xs text-gray-500">Affichée si la valeur est supérieure à 0.</div>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>
                Annuler
              </Button>
              <Button variant="green" onClick={save}>
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
