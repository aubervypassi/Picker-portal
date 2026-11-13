import { Fragment, useMemo, useState } from 'react';
import { CalendarDays, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, FileDown, Moon, Printer, RotateCcw, Save, Send } from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Badge, Button, Card, PageHeader, Select, useUI } from '../components/ui';
import {
  DAYS,
  EDIT_CODES,
  SHIFT_INFO,
  addDays,
  agentShift,
  autoShift,
  fmtDate,
  fmtDateTime,
  isLead,
  lvl,
  mondayOf,
  nightPicker,
  nightTeam,
  ovKey,
  shiftFor,
  storeAgents,
  teamOf,
  ymd,
} from '../lib/utils';
import type { ShiftCode, StoreId, User } from '../types';

type Mode = 'semaine' | 'mois';
const dayLabel = (d: Date) => DAYS[(d.getDay() + 6) % 7];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export default function Planning({ scope }: PageProps) {
  const { db, me: meMaybe, update, notify } = useDB();
  const me = meMaybe!;
  const ui = useUI();
  const [mode, setMode] = useState<Mode>('semaine');
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [store, setStore] = useState<StoreId>(scope === 'ALL' ? 'ABN' : scope);
  const [exportOpen, setExportOpen] = useState(false);
  const canEdit = lvl(me) >= 2;
  const effStore: StoreId = scope === 'ALL' ? store : scope;
  const st = db.stores.find((s) => s.id === effStore)!;
  const todayStr = ymd(new Date());

  // Période affichée
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const days = useMemo(() => {
    if (mode === 'semaine') return Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
    const n = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth(), i + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, anchor.getTime()]);
  const periodKey = mode === 'semaine' ? `S|${ymd(anchor)}` : `M|${ymd(monthStart).slice(0, 7)}`;
  const periodLabel = mode === 'semaine' ? `Semaine du ${fmtDate(anchor)}` : `${MONTHS[anchor.getMonth()][0].toUpperCase()}${MONTHS[anchor.getMonth()].slice(1)} ${anchor.getFullYear()}`;
  const move = (dir: -1 | 1) => setAnchor(mode === 'semaine' ? addDays(anchor, 7 * dir) : new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
  const switchMode = (m: Mode) => {
    setMode(m);
    setAnchor(m === 'semaine' ? mondayOf(new Date()) : new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  };

  const agents = useMemo(() => storeAgents(db, effStore, false), [db, effStore]);
  const groups = useMemo(() => {
    const order = effStore === 'ABN' ? ['Outbound A', 'Outbound B', 'Outbound C', 'Inbound'] : ['Outbound', 'Hub', 'Inbound'];
    const teams = Array.from(new Set([...order, ...agents.map((a) => teamOf(db, a))]));
    return teams
      .map((t) => ({
        team: t,
        members: agents.filter((a) => teamOf(db, a) === t).sort((a, b) => Number(isLead(b.role)) - Number(isLead(a.role)) || a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.members.length);
  }, [agents, db, effStore]);

  const pubStamp = db.planningPublished[`${effStore}|${periodKey}`];
  const draftStamp = db.planningDrafts[`${effStore}|${periodKey}`];
  const unpublished = useMemo(
    () => days.some((d) => agents.some((a) => db.publishedDays[`${effStore}|${ymd(d)}`]?.[a.id] !== shiftFor(db, a, d))),
    [days, agents, db, effStore],
  );

  const setShift = (u: User, d: Date, code: ShiftCode | null) =>
    update((x) => {
      const k = ovKey(effStore, d, u.id);
      if (code === null) delete x.planningOverrides[k];
      else x.planningOverrides[k] = code;
    });

  const label = (c: ShiftCode) => (c ? SHIFT_INFO[c].label : '');
  const exportRows = (): (string | number)[][] => [
    ['Équipe', 'ID', 'Nom', 'Fonction', 'Picker Lead', ...days.map((d) => `${dayLabel(d)} ${fmtDate(d)}`)],
    ...groups.flatMap((g) =>
      g.members.map((u) => [g.team, u.id, u.name, u.role, db.users.find((l) => l.id === u.leadId)?.name || '', ...days.map((d) => label(shiftFor(db, u, d)))]),
    ),
  ];

  const coverage = (d: Date) => {
    const c: Record<string, number> = { M: 0, S: 0, N: 0, H: 0, I: 0 };
    agents.forEach((a) => {
      const s = shiftFor(db, a, d);
      if (s in c) c[s]++;
    });
    return c;
  };

  const Nav = (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="outline" icon={ChevronLeft} onClick={() => move(-1)} aria-label="Précédent" />
      <button className="text-sm font-bold px-2 min-w-[150px]" onClick={() => switchMode(mode)}>
        {periodLabel}
      </button>
      <Button size="sm" variant="outline" icon={ChevronRight} onClick={() => move(1)} aria-label="Suivant" />
    </div>
  );
  const ModeToggle = (
    <div className="inline-flex rounded-xl bg-white border p-1">
      {(
        [
          ['semaine', 'Vue Hebdomadaire', CalendarDays],
          ['mois', 'Planning Mensuel', CalendarRange],
        ] as const
      ).map(([k, l, I]) => (
        <button key={k} onClick={() => switchMode(k)} className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 ${mode === k ? 'bg-glovo-yellow' : 'text-gray-500'}`}>
          <I className="w-4 h-4" /> {l}
        </button>
      ))}
    </div>
  );

  /* ---------- Vue personnelle (Niveau 1) ---------- */
  if (!canEdit) {
    const mine = days.map((d) => ({ d, ...agentShift(db, me, d) }));
    const allPub = mine.every((x) => x.published);
    return (
      <div>
        <PageHeader title="Mon planning" subtitle={`${st.name} • ${teamOf(db, me)}`} icon={CalendarDays} />
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {ModeToggle}
          {Nav}
          {allPub ? <Badge color="green">Planning publié</Badge> : <Badge color="yellow">Provisoire — en attente de publication</Badge>}
        </div>
        {mode === 'semaine' ? (
          <div className="space-y-2">
            {mine.map(({ d, code }) => (
              <Card key={ymd(d)} className={`p-3 flex items-center gap-3 ${ymd(d) === todayStr ? 'ring-2 ring-glovo-yellow' : ''}`}>
                <div className="w-14 text-center">
                  <div className="text-xs text-gray-500">{dayLabel(d)}</div>
                  <div className="text-lg font-extrabold">{d.getDate()}</div>
                </div>
                <div className={`flex-1 rounded-xl border px-3 py-2 ${code ? SHIFT_INFO[code].cls : 'bg-gray-50'}`}>
                  <div className="font-bold">{label(code) || '—'}</div>
                  <div className="text-xs">{code ? SHIFT_INFO[code].name : ''}</div>
                </div>
                {code === 'N' && <Moon className="w-5 h-5 text-indigo-700" />}
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-500">
                {d}
              </div>
            ))}
            {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
              <div key={'e' + i} />
            ))}
            {mine.map(({ d, code }) => (
              <div key={ymd(d)} className={`rounded-lg border p-1 min-h-[52px] ${code ? SHIFT_INFO[code].cls : 'bg-white'} ${ymd(d) === todayStr ? 'ring-2 ring-glovo-ink' : ''}`}>
                <div className="text-[10px] font-bold">{d.getDate()}</div>
                <div className="text-[9px] leading-tight font-semibold">{label(code)}</div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-4">
          Nuit : le picker désigné est en « Repos » le jour où son équipe fait 1600 - 0000, puis prend son poste en « 0000 - 0800 » le lendemain.
        </p>
      </div>
    );
  }

  /* ---------- Vue gestion (Niveaux 2 à 4) ---------- */
  const cellW = mode === 'semaine' ? 'min-w-[108px]' : 'min-w-[94px]';
  const restCount = (u: User) => days.filter((d) => shiftFor(db, u, d) === 'R').length;

  return (
    <div>
      <PageHeader
        title="Planning H24"
        subtitle={`${st.name} — calcul automatique + édition cellule par cellule`}
        icon={CalendarDays}
        actions={
          <>
            <Button
              variant="outline"
              icon={Save}
              onClick={() => {
                update((d) => {
                  d.planningDrafts[`${effStore}|${periodKey}`] = new Date().toISOString();
                });
                ui.toast('Brouillon enregistré — non visible des agents tant qu’il n’est pas publié');
              }}
            >
              Enregistrer brouillon
            </Button>
            <Button
              variant="green"
              icon={Send}
              onClick={() => {
                update((d) => {
                  days.forEach((day) => {
                    const snap: Record<string, ShiftCode> = {};
                    agents.forEach((a) => (snap[a.id] = shiftFor(db, a, day)));
                    d.publishedDays[`${effStore}|${ymd(day)}`] = snap;
                  });
                  d.planningPublished[`${effStore}|${periodKey}`] = new Date().toISOString();
                });
                notify(
                  agents.map((a) => a.id),
                  `📅 Planning publié : ${periodLabel} (${st.name}).`,
                );
                ui.toast('Planning publié et agents notifiés');
              }}
            >
              Publier le planning
            </Button>
            <div className="relative">
              <Button variant="outline" icon={FileDown} onClick={() => setExportOpen(!exportOpen)}>
                Exporter (PDF / CSV) <ChevronDown className="w-3 h-3" />
              </Button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border z-20 overflow-hidden">
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => {
                      setExportOpen(false);
                      ui.printPage(`Planning ${st.name} ${periodLabel}`);
                    }}
                  >
                    <Printer className="w-4 h-4" /> Export PDF
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 border-t"
                    onClick={() => {
                      setExportOpen(false);
                      ui.exportCSV(`planning_${effStore}_${periodKey.replace('|', '_')}.csv`, exportRows());
                    }}
                  >
                    <FileDown className="w-4 h-4" /> Export CSV
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-3 no-print">
        {ModeToggle}
        {scope === 'ALL' && (
          <Select value={store} onChange={(e) => setStore(e.target.value as StoreId)} className="!w-auto">
            {db.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        {Nav}
        {pubStamp ? <Badge color="green">Publié le {fmtDateTime(pubStamp)}</Badge> : <Badge color="gray">Jamais publié</Badge>}
        {unpublished && <Badge color="yellow">Modifications non publiées</Badge>}
        {draftStamp && <Badge color="blue">Brouillon du {fmtDateTime(draftStamp)}</Badge>}
        <Button
          size="sm"
          variant="ghost"
          icon={RotateCcw}
          onClick={() =>
            update((d) => {
              const keys = new Set(days.map((x) => ymd(x)));
              Object.keys(d.planningOverrides).forEach((k) => {
                const [s, date] = k.split('|');
                if (s === effStore && keys.has(date)) delete d.planningOverrides[k];
              });
            })
          }
        >
          Recalculer la période
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3 no-print">
        {EDIT_CODES.map((c) => (
          <span key={c} className={`text-[11px] px-2 py-1 rounded-lg border font-semibold ${SHIFT_INFO[c].cls}`}>
            {SHIFT_INFO[c].label}
            {SHIFT_INFO[c].hours && <span className="font-normal opacity-70"> ({SHIFT_INFO[c].name})</span>}
          </span>
        ))}
      </div>

      <div className="print-area">
        <div className="hidden print:block mb-2">
          <h2 className="text-lg font-bold">
            Planning {st.name} — {periodLabel}
          </h2>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="text-left px-3 py-2 sticky left-0 bg-gray-50 z-10 min-w-[170px]">Agent</th>
                  {days.map((d) => (
                    <th key={ymd(d)} className={`px-1 py-2 text-center ${cellW} ${ymd(d) === todayStr ? 'bg-glovo-yellow/30 text-glovo-ink' : ''} ${d.getDay() === 0 ? 'border-r-2 border-gray-200' : ''}`}>
                      <div>{dayLabel(d)}</div>
                      <div className="font-normal">
                        {d.getDate()}/{d.getMonth() + 1}
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center">Repos</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const leads = g.members.filter((m) => isLead(m.role));
                  return (
                    <Fragment key={g.team}>
                      <tr className="bg-glovo-ink text-white">
                        <td colSpan={days.length + 2} className="px-3 py-1.5 font-bold text-xs uppercase tracking-wide">
                          <span className="sticky left-3">
                            {g.team} <span className="font-normal opacity-70">({g.members.length})</span>
                            {leads.length > 0 && <span className="ml-2 normal-case font-normal text-glovo-yellow">Lead : {leads.map((l) => l.name).join(', ')}</span>}
                          </span>
                        </td>
                      </tr>
                      {g.members.map((u) => {
                        const rc = restCount(u);
                        const minRest = mode === 'semaine' ? 2 : Math.floor(days.length / 7) * 2;
                        return (
                          <tr key={u.id} className="border-t">
                            <td className="px-3 py-1 sticky left-0 bg-white z-10">
                              <div className="font-semibold truncate max-w-[170px] text-sm">{u.name}</div>
                              <div className="text-[10px] text-gray-400">
                                {u.id} • {u.role}
                              </div>
                            </td>
                            {days.map((d) => {
                              const s = shiftFor(db, u, d);
                              const manual = ovKey(effStore, d, u.id) in db.planningOverrides;
                              const auto = autoShift(db, effStore, u, d);
                              return (
                                <td key={ymd(d)} className={`p-0.5 text-center ${d.getDay() === 0 ? 'border-r-2 border-gray-200' : ''}`}>
                                  <div className="relative">
                                    <select
                                      value={s || ''}
                                      onChange={(e) => setShift(u, d, e.target.value === '__auto' ? null : (e.target.value as ShiftCode))}
                                      className={`print:hidden w-full appearance-none rounded-lg border px-1 py-1.5 text-center font-bold text-[11px] cursor-pointer ${s ? SHIFT_INFO[s].cls : 'bg-white border-dashed'}`}
                                      title={s ? `${SHIFT_INFO[s].label} (${SHIFT_INFO[s].name})` : ''}
                                    >
                                      {s && !EDIT_CODES.includes(s as any) && <option value={s}>{SHIFT_INFO[s].label}</option>}
                                      {!s && <option value="">—</option>}
                                      {EDIT_CODES.map((c) => (
                                        <option key={c} value={c}>
                                          {SHIFT_INFO[c].label}
                                        </option>
                                      ))}
                                      {manual && <option value="__auto">↺ Auto ({auto ? SHIFT_INFO[auto].label : '—'})</option>}
                                    </select>
                                    <span className="hidden print:block font-semibold">{label(s)}</span>
                                    {manual && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-glovo-red print:hidden" />}
                                  </div>
                                </td>
                              );
                            })}
                            <td className={`text-center font-bold px-2 ${effStore === 'ABJ' && rc < minRest ? 'text-glovo-red' : 'text-gray-500'}`}>{rc}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
                <tr className="border-t-2 bg-gray-50">
                  <td className="px-3 py-2 font-bold sticky left-0 bg-gray-50">Couverture</td>
                  {days.map((d) => {
                    const c = coverage(d);
                    const nightBad = c.N !== 1;
                    const dayBad = effStore === 'ABJ' ? c.M < 2 || c.S < 2 : c.M < 1 || c.S < 1;
                    return (
                      <td key={ymd(d)} className="p-1 text-center text-[10px] leading-tight">
                        <div className={dayBad ? 'text-glovo-red font-bold' : ''}>
                          M{c.M} · S{c.S}
                        </div>
                        <div className={nightBad ? 'text-glovo-red font-bold' : 'text-indigo-700'}>N{c.N}</div>
                        {(c.H > 0 || c.I > 0) && <div className="text-violet-700">{c.H > 0 ? `Hub ${c.H}` : `Inb ${c.I}`}</div>}
                      </td>
                    );
                  })}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {mode === 'semaine' && (
        <Card className="p-4 mt-4 no-print">
          <div className="font-bold flex items-center gap-2 mb-1">
            <Moon className="w-4 h-4 text-indigo-700" /> Roulement de nuit (0000 - 0800)
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Le picker désigné est marqué « Repos » le jour J (son équipe fait 1600 - 0000) et inscrit en « 0000 - 0800 » le jour J+1. Rotation automatique ; vous pouvez désigner un autre picker.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {days.map((d) => {
              const { team, members } = nightTeam(db, effStore, d);
              const cur = nightPicker(db, effStore, d);
              return (
                <div key={ymd(d)} className="rounded-xl border p-2">
                  <div className="text-xs font-semibold text-gray-500">
                    Nuit {dayLabel(addDays(d, -1))} → {dayLabel(d)} {d.getDate()}/{d.getMonth() + 1}
                    {team && ` • ${team}`}
                  </div>
                  <Select
                    value={cur || ''}
                    className="mt-1 !py-1.5 text-xs"
                    onChange={(e) =>
                      update((x) => {
                        x.nightOverrides[`${effStore}|${ymd(d)}`] = e.target.value;
                      })
                    }
                  >
                    {members.length === 0 && <option value="">Aucun picker disponible</option>}
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-4 mt-4 text-xs text-gray-600 no-print">
        <b>Règles de calcul automatique — </b>
        {effStore === 'ABN'
          ? 'Les équipes Outbound sont composées à partir du Picker Lead référent de chaque picker. Cycle de 3 jours par équipe : 0800 - 1600 → 1600 - 0000 → Repos. Inbound : 0800 - 1600 du lundi au samedi, 2 jours de repos (dimanche + 1 tournant).'
          : '2 jours de Repos par semaine pour tous (colonne « Repos » en rouge si < 2). Picker Hub : uniquement 0800 - 1700. Pickers : objectif 2 en 0800 - 1600, 2 en 1600 - 0000 et 1 en 0000 - 0800 chaque jour selon l’effectif disponible ; les Picker Leads complètent la couverture.'}{' '}
        Chaque case est modifiable via son menu déroulant (point rouge = modification manuelle). Les agents ne voient que le planning publié.
      </Card>
    </div>
  );
}
