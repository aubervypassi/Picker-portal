import { useMemo, useState } from 'react';
import { CalendarCheck, Printer, Save, Wallet } from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Button, Card, Field, Input, PageHeader, Select, useUI } from '../components/ui';
import { SHIFT_INFO, agentShift, fcfa, isLead, isManager, isStaff, isSuper, rateFor, shiftFor } from '../lib/utils';
import type { PayConfig } from '../types';

const LINES = [
  { key: 'normal', label: 'Heures normales', maj: null },
  { key: 'ot', label: 'Heures supplémentaires', maj: 'overtime' },
  { key: 'night', label: 'Heures de nuit', maj: 'night' },
  { key: 'holiday', label: 'Heures jours fériés', maj: 'holiday' },
  { key: 'holidayNight', label: 'Heures jours fériés nuit', maj: 'holidayNight' },
] as const;

type Hours = Record<(typeof LINES)[number]['key'] | 'absence', number>;
const EMPTY: Hours = { normal: 0, ot: 0, night: 0, holiday: 0, holidayNight: 0, absence: 0 };

export default function Paie({ scope }: PageProps) {
  const { db, me: meMaybe, update } = useDB();
  const me = meMaybe!;
  const ui = useUI();
  const admin = isManager(me);
  const superAdmin = isSuper(me);
  const candidates = db.users.filter((u) => isStaff(u) && (scope === 'ALL' || u.store === scope));
  const [userId, setUserId] = useState(admin ? candidates[0]?.id || '' : me.id);
  const user = db.users.find((u) => u.id === userId) || (admin ? candidates[0] : me);
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [h, setH] = useState<Hours>(EMPTY);
  const [cfg, setCfg] = useState<PayConfig>(db.pay);

  const rate = user ? rateFor(db, user.role) : db.pay.rateAgent;

  const prefill = () => {
    if (!user) return;
    const [y, m] = month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    let normal = 0,
      night = 0;
    const weekHours: Record<string, number> = {};
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m - 1, d);
      const s = admin ? shiftFor(db, user, date) : agentShift(db, user, date).code;
      if (!s) continue;
      const info = SHIFT_INFO[s];
      night += info.night;
      normal += info.worked - info.night;
      const wkKey = `${Math.floor((d + ((new Date(y, m - 1, 1).getDay() + 6) % 7) - 1) / 7)}`;
      weekHours[wkKey] = (weekHours[wkKey] || 0) + info.worked;
    }
    // Au-delà de 40h/semaine → heures supplémentaires (prises sur les heures normales)
    const ot = Object.values(weekHours).reduce((a, w) => a + Math.max(0, w - 40), 0);
    setH({ ...h, normal: Math.max(0, normal - ot), night, ot });
    ui.toast('Heures pré-remplies depuis le planning (à ajuster si besoin)');
  };

  const calc = useMemo(() => {
    const normalNet = Math.max(0, h.normal - h.absence);
    const rows = LINES.map((l) => {
      const hours = l.key === 'normal' ? normalNet : h[l.key];
      const pct = l.maj ? (cfg as any)[l.maj] : 0;
      const r = rate * (1 + pct / 100);
      return { ...l, hours, pct, r, amount: hours * r };
    });
    const total = rows.reduce((a, r) => a + r.amount, 0);
    const totalHours = rows.reduce((a, r) => a + r.hours, 0);
    return { rows, total, totalHours, normalNet };
  }, [h, cfg, rate]);

  const num = (k: keyof Hours) => (
    <Input type="number" min={0} step={0.5} value={h[k] || ''} placeholder="0" onChange={(e) => setH({ ...h, [k]: Math.max(0, Number(e.target.value) || 0) })} />
  );

  return (
    <div>
      <PageHeader
        title="Simulateur de salaire"
        subtitle="Estimation en FCFA selon le barème Glovo en vigueur"
        icon={Wallet}
        actions={
          <Button variant="outline" icon={Printer} onClick={() => ui.printPage(`Simulation paie ${user?.name} ${month}`)}>
            Exporter PDF
          </Button>
        }
      />
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-4 no-print">
          <Card className="p-4 space-y-3">
            {admin && (
              <Field label="Agent">
                <Select value={user?.id} onChange={(e) => setUserId(e.target.value)}>
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.role}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mois">
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </Field>
              <Field label="Taux horaire de base">
                <div className="rounded-xl bg-glovo-bg border px-3 py-2 text-sm font-bold">{fcfa(rate)}/h</div>
              </Field>
            </div>
            <Button variant="outline" icon={CalendarCheck} className="w-full" onClick={prefill}>
              Pré-remplir depuis le planning
            </Button>
          </Card>
          <Card className="p-4 space-y-3">
            <div className="font-bold text-sm">Volume horaire du mois</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heures normales">{num('normal')}</Field>
              <Field label={`Heures sup. (+${cfg.overtime}%)`}>{num('ot')}</Field>
              <Field label={`Heures de nuit (+${cfg.night}%)`}>{num('night')}</Field>
              <Field label={`Jours fériés (+${cfg.holiday}%)`}>{num('holiday')}</Field>
              <Field label={`Fériés nuit (+${cfg.holidayNight}%)`}>{num('holidayNight')}</Field>
              <Field label="Heures d'absence" hint="Déduites des heures normales">
                {num('absence')}
              </Field>
            </div>
          </Card>
          {superAdmin && (
            <Card className="p-4 space-y-3">
              <div className="font-bold text-sm">Barème & majorations (Super Admin)</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Picker / Inbound / Hub (FCFA/h)">
                  <Input type="number" value={cfg.rateAgent} onChange={(e) => setCfg({ ...cfg, rateAgent: Number(e.target.value) })} />
                </Field>
                <Field label="Picker Lead (FCFA/h)">
                  <Input type="number" value={cfg.rateLead} onChange={(e) => setCfg({ ...cfg, rateLead: Number(e.target.value) })} />
                </Field>
                <Field label="Heures sup. (%)">
                  <Input type="number" value={cfg.overtime} onChange={(e) => setCfg({ ...cfg, overtime: Number(e.target.value) })} />
                </Field>
                <Field label="Nuit (%)">
                  <Input type="number" value={cfg.night} onChange={(e) => setCfg({ ...cfg, night: Number(e.target.value) })} />
                </Field>
                <Field label="Férié (%)">
                  <Input type="number" value={cfg.holiday} onChange={(e) => setCfg({ ...cfg, holiday: Number(e.target.value) })} />
                </Field>
                <Field label="Férié nuit (%)">
                  <Input type="number" value={cfg.holidayNight} onChange={(e) => setCfg({ ...cfg, holidayNight: Number(e.target.value) })} />
                </Field>
              </div>
              <Button
                variant="green"
                icon={Save}
                className="w-full"
                onClick={() => {
                  update((d) => {
                    d.pay = cfg;
                  });
                  ui.toast('Barème enregistré pour tous les agents');
                }}
              >
                Enregistrer le barème
              </Button>
            </Card>
          )}
        </div>

        <div className="lg:col-span-3 print-area">
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-gray-500">Simulation — {new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
                <div className="font-extrabold text-lg">{user?.name}</div>
                <div className="text-xs text-gray-500">
                  {user?.role} • ID {user?.id} • {db.stores.find((s) => s.id === user?.store)?.name}
                </div>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${user && isLead(user.role) ? 'bg-glovo-yellow' : 'bg-glovo-green text-white'}`}>{fcfa(rate)}/h</span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">Rubrique</th>
                  <th className="text-right py-2">Heures</th>
                  <th className="text-right py-2">Taux</th>
                  <th className="text-right py-2">Montant</th>
                </tr>
              </thead>
              <tbody>
                {calc.rows.map((r) => (
                  <tr key={r.key} className="border-b last:border-0">
                    <td className="py-2">
                      {r.label} {r.pct > 0 && <span className="text-xs text-glovo-green font-semibold">+{r.pct}%</span>}
                      {r.key === 'normal' && h.absence > 0 && <div className="text-[11px] text-glovo-red">− {h.absence} h d'absence déduites</div>}
                    </td>
                    <td className="text-right">{r.hours}</td>
                    <td className="text-right whitespace-nowrap">{Math.round(r.r)}</td>
                    <td className="text-right font-semibold whitespace-nowrap">{fcfa(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-5 rounded-2xl bg-glovo-ink text-white p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-white/70">Total estimé ({calc.totalHours} h)</div>
                <div className="text-3xl font-extrabold text-glovo-yellow">{fcfa(calc.total)}</div>
              </div>
              <Wallet className="w-10 h-10 text-glovo-yellow" />
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              Simulation indicative avant cotisations et retenues légales. Le bulletin officiel fait foi.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
