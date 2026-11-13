import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileDown, LayoutList, Pencil, Plus, Search, Trash2, Upload, UserCog, Users } from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, useConfirm, useUI } from '../components/ui';
import { AGENT_ROLES, type Role, type StoreId, type User } from '../types';
import { assignLeads, defaultLevel, defaultTeam, randomPin, storeIdFromName } from '../data/seed';
import { isLead, isManager, isStaff, teamOf } from '../lib/utils';

const LEAD_TEAMS: Record<StoreId, string[]> = {
  ABN: ['Outbound A', 'Outbound B', 'Outbound C', 'Inbound'],
  ABJ: ['Outbound', 'Inbound'],
};
const TEMPLATE_HEADER = ['Store', 'ID', 'Nom et Prenoms', 'Fonction', 'ID_Picker_Lead'];
const TEMPLATE_ROWS = [
  ['ABN - Cocody', '200001', 'Exemple Picker', 'Picker', '136346'],
  ['ABN - Cocody', '200002', 'Exemple Inbound', 'Picker Inbound', '8076'],
  ['ABJ - Koumassi', '200003', 'Exemple Hub', 'Picker Hub', '17364'],
];

const roleColor = (r: Role) => (isLead(r) ? 'yellow' : r === 'Picker Inbound' ? 'green' : r === 'Picker Hub' ? 'indigo' : 'blue');

/** Parseur CSV tolérant (séparateur ; , ou tabulation, guillemets) */
function parseCSV(text: string): Record<string, string>[] {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const sep = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell), rows.push(row), (row = []), (cell = '');
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
function toRole(raw: string): Role | null {
  const n = norm(raw);
  if (!n) return 'Picker';
  if (n.includes('lead') && n.includes('inbound')) return 'Picker Lead Inbound';
  if (n.includes('lead')) return 'Picker Lead Outbound';
  if (n.includes('hub')) return 'Picker Hub';
  if (n.includes('inbound')) return 'Picker Inbound';
  if (n.includes('picker')) return 'Picker';
  return null;
}

export default function Pickers({ scope }: PageProps) {
  const { db, me, update } = useDB();
  const ui = useUI();
  const { confirm, node } = useConfirm();
  const manage = isManager(me);
  const [store, setStore] = useState<'ALL' | StoreId>(scope);
  const [role, setRole] = useState<'ALL' | Role>('ALL');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'liste' | 'leads'>('liste');
  const [edit, setEdit] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const effStore = scope === 'ALL' ? store : scope;

  const leadsOf = (st: StoreId | 'ALL') => db.users.filter((u) => u.store === st && isLead(u.role) && u.status === 'Actif').sort((a, b) => a.name.localeCompare(b.name));
  const nameOf = (id?: string) => db.users.find((u) => u.id === id)?.name;

  const list = useMemo(
    () =>
      db.users
        .filter(isStaff)
        .filter((u) => effStore === 'ALL' || u.store === effStore)
        .filter((u) => role === 'ALL' || u.role === role)
        .filter((u) => !q || (u.name + ' ' + u.id + ' ' + teamOf(db, u) + ' ' + (nameOf(u.leadId) || '')).toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.store.localeCompare(b.store) || teamOf(db, a).localeCompare(teamOf(db, b)) || Number(isLead(b.role)) - Number(isLead(a.role)) || a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, effStore, role, q],
  );

  const storeName = (s: string) => db.stores.find((x) => x.id === s)?.name || s;
  const rows = (): (string | number)[][] => [
    ['Store', 'ID', 'Nom et Prenoms', 'Fonction', 'ID_Picker_Lead', 'Picker Lead', 'Équipe', 'Statut'],
    ...list.map((u) => [storeName(u.store), u.id, u.name, u.role, u.leadId || '', nameOf(u.leadId) || '', teamOf(db, u), u.status]),
  ];

  const setLead = (u: User, leadId: string) =>
    update((d) => {
      const x = d.users.find((y) => y.id === u.id)!;
      x.leadId = leadId || undefined;
      const l = d.users.find((y) => y.id === leadId);
      if (l && x.role === 'Picker') x.team = l.team; // l'équipe suit le Picker Lead
    });

  const save = () => {
    if (!edit) return;
    if (!edit.id.trim() || !edit.name.trim()) return ui.toast('ID et nom obligatoires', 'err');
    if (isNew && db.users.some((u) => u.id === edit.id.trim())) return ui.toast('Cet ID existe déjà', 'err');
    update((d) => {
      const clean: User = { ...edit, id: edit.id.trim(), name: edit.name.trim() };
      if (isLead(clean.role)) clean.leadId = undefined;
      const l = d.users.find((y) => y.id === clean.leadId);
      if (l && clean.role === 'Picker') clean.team = l.team;
      if (clean.role === 'Picker Hub') clean.team = 'Hub';
      if (clean.role === 'Picker Inbound') clean.team = 'Inbound';
      const i = d.users.findIndex((u) => u.id === clean.id);
      if (i >= 0) d.users[i] = clean;
      else d.users.push(clean);
      // si un lead change d'équipe, son équipe le suit
      if (isLead(clean.role)) d.users.forEach((u) => u.leadId === clean.id && u.role === 'Picker' && (u.team = clean.team));
    });
    ui.toast(isNew ? `Agent ajouté — PIN : ${edit.pin}` : 'Agent mis à jour');
    setEdit(null);
  };

  const remove = (u: User) =>
    confirm(`Retirer ${u.name} (ID ${u.id}) de l'effectif ? Son accès sera supprimé. L'historique de pointage est conservé.`, () => {
      update((d) => {
        d.users = d.users.filter((x) => x.id !== u.id);
        d.users.forEach((x) => x.leadId === u.id && (x.leadId = undefined));
      });
      ui.toast('Agent retiré');
    });

  const onImport = async (file: File) => {
    try {
      let data: Record<string, any>[];
      if (/\.csv$/i.test(file.name)) data = parseCSV(await file.text());
      else {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      }
      const col = (row: Record<string, any>, test: (n: string) => boolean) => {
        const k = Object.keys(row).find((c) => test(norm(c)));
        return k ? String(row[k]).trim() : '';
      };
      let added = 0,
        updated = 0,
        skipped = 0,
        badLead = 0;
      const links: [string, string][] = [];
      update((d) => {
        data.forEach((row) => {
          const id = col(row, (n) => !n.includes('lead') && (n === 'id' || n === 'idglovo' || n.includes('matricule')));
          const name = col(row, (n) => n.startsWith('nom') || n === 'name');
          const st = storeIdFromName(col(row, (n) => n.includes('store') || n.includes('magasin') || n === 'site'));
          const r = toRole(col(row, (n) => n.includes('fonction') || n === 'role' || n.includes('poste')));
          const leadId = col(row, (n) => n.includes('lead'));
          if (!id || !name || !st || !r || (scope !== 'ALL' && st !== scope)) return skipped++;
          const ex = d.users.find((u) => u.id === id);
          const team = r === 'Picker Hub' ? 'Hub' : r.includes('Inbound') ? 'Inbound' : ex?.team || defaultTeam(st, r, d.users.filter((u) => u.store === st).length);
          if (ex) {
            if (!isStaff(ex)) return skipped++;
            Object.assign(ex, { name, store: st, role: r, team, level: defaultLevel(r, st) });
            updated++;
          } else {
            d.users.push({ id, name, store: st, role: r, team, pin: randomPin(), level: defaultLevel(r, st), status: 'Actif' });
            added++;
          }
          if (leadId && !isLead(r)) links.push([id, leadId]);
        });
        // rattachements après insertion (le lead peut être dans le même fichier)
        links.forEach(([id, leadId]) => {
          const u = d.users.find((x) => x.id === id)!;
          const l = d.users.find((x) => x.id === leadId && x.store === u.store && isLead(x.role));
          if (!l) return badLead++;
          u.leadId = l.id;
          if (u.role === 'Picker') u.team = l.team;
        });
        assignLeads(d.users);
      });
      ui.toast(`Import : ${added} ajouté(s), ${updated} mis à jour, ${skipped} ignoré(s)${badLead ? `, ${badLead} lead introuvable(s)` : ''}`, badLead || skipped ? 'info' : 'ok');
    } catch (e: any) {
      ui.toast('Import impossible : ' + e.message, 'err');
    }
  };

  const LeadSelect = ({ u }: { u: User }) =>
    isLead(u.role) ? (
      <span className="text-xs text-gray-400">— (Lead)</span>
    ) : manage ? (
      <select
        value={u.leadId || ''}
        onChange={(e) => setLead(u, e.target.value)}
        className={`text-xs rounded-lg border px-2 py-1 max-w-[170px] ${u.leadId ? 'border-gray-300 bg-white' : 'border-glovo-red bg-red-50'}`}
      >
        <option value="">— Non rattaché —</option>
        {leadsOf(u.store).map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} ({l.team})
          </option>
        ))}
      </select>
    ) : (
      <span className="text-sm">{nameOf(u.leadId) || '—'}</span>
    );

  const grouped = useMemo(() => {
    const stores = (effStore === 'ALL' ? db.stores.map((s) => s.id) : [effStore]) as StoreId[];
    return stores.map((st) => ({
      st,
      leads: leadsOf(st).map((l) => ({ lead: l, members: list.filter((u) => u.leadId === l.id && !isLead(u.role)) })),
      orphans: list.filter((u) => u.store === st && !isLead(u.role) && !leadsOf(st).some((l) => l.id === u.leadId)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, list, effStore]);

  return (
    <div>
      {node}
      <PageHeader
        title="Équipes & Pickers"
        subtitle={`${list.length} agent(s) • rattachement Picker ↔ Picker Lead`}
        icon={Users}
        actions={
          <>
            {manage && (
              <Button
                icon={Plus}
                onClick={() => {
                  const st = (effStore === 'ALL' ? 'ABN' : effStore) as StoreId;
                  setIsNew(true);
                  setEdit({ id: '', name: '', role: 'Picker', store: st, team: LEAD_TEAMS[st][0], leadId: leadsOf(st)[0]?.id, pin: randomPin(), level: 1, status: 'Actif' });
                }}
              >
                Ajouter
              </Button>
            )}
            <Button variant="outline" icon={Download} onClick={() => ui.exportCSV('pickers.csv', rows())}>
              CSV
            </Button>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => ui.exportXLSX('pickers.xlsx', rows(), 'Pickers')}>
              Excel
            </Button>
          </>
        }
      />

      {manage && (
        <Card className="p-4 mb-4 border-dashed border-2 border-glovo-yellow/70 bg-glovo-yellow/5">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="green" icon={Upload} onClick={() => fileRef.current?.click()}>
              Importer un fichier CSV / Excel
            </Button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = '';
              }}
            />
          </div>
          <div className="mt-3 rounded-xl bg-white border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold">Modèle d'import</div>
              <Button size="sm" variant="outline" icon={FileDown} onClick={() => ui.exportCSV('modele_import_pickers.csv', [TEMPLATE_HEADER, ...TEMPLATE_ROWS])}>
                Télécharger le modèle CSV (.csv)
              </Button>
            </div>
            <div className="mt-2 overflow-x-auto">
              <code className="block text-xs bg-glovo-ink text-glovo-yellow rounded-lg px-3 py-2 whitespace-nowrap">{TEMPLATE_HEADER.join(';')}</code>
              <code className="block text-[11px] text-gray-500 px-3 py-1 whitespace-nowrap">{TEMPLATE_ROWS[0].join(';')}</code>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Fonction : Picker, Picker Inbound, Picker Hub, Picker Lead Outbound, Picker Lead Inbound. <b>ID_Picker_Lead</b> = ID Glovo du Picker Lead du même store (vide pour un Lead). Un PIN est généré pour chaque nouvel agent ; un agent déjà présent est mis à jour.
            </p>
          </div>
        </Card>
      )}

      <Card className="p-3 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Rechercher nom, ID, équipe, lead…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={effStore} onChange={(e) => setStore(e.target.value as any)} disabled={scope !== 'ALL'}>
          <option value="ALL">Tous les stores</option>
          {db.stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select value={role} onChange={(e) => setRole(e.target.value as any)}>
          <option value="ALL">Toutes les fonctions</option>
          {AGENT_ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Card>

      <div className="inline-flex rounded-xl bg-white border p-1 mb-3">
        {(
          [
            ['liste', 'Liste', LayoutList],
            ['leads', 'Vue par Picker Lead', UserCog],
          ] as const
        ).map(([k, l, I]) => (
          <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 ${view === k ? 'bg-glovo-yellow' : 'text-gray-500'}`}>
            <I className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>

      {view === 'liste' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Nom et Prénoms</th>
                  <th className="px-4 py-3">Fonction</th>
                  <th className="px-4 py-3">Picker Lead</th>
                  <th className="px-4 py-3">Équipe</th>
                  <th className="px-4 py-3">Statut</th>
                  {manage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{storeName(u.store)}</td>
                    <td className="px-4 py-2.5 font-mono">{u.id}</td>
                    <td className="px-4 py-2.5 font-semibold">{u.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge color={roleColor(u.role) as any}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <LeadSelect u={u} />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{teamOf(db, u)}</td>
                    <td className="px-4 py-2.5">
                      <Badge color={u.status === 'Actif' ? 'green' : 'red'}>{u.status}</Badge>
                    </td>
                    {manage && (
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          className="p-1.5 rounded-lg hover:bg-gray-100"
                          onClick={() => {
                            setIsNew(false);
                            setEdit({ ...u });
                          }}
                          aria-label="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-red-50 text-glovo-red" onClick={() => remove(u)} aria-label="Retirer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.length === 0 && <Empty text="Aucun agent ne correspond aux filtres." />}
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.st}>
              {effStore === 'ALL' && <h2 className="font-extrabold mb-2">{storeName(g.st)}</h2>}
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {g.leads.map(({ lead, members }) => (
                  <Card key={lead.id} className="p-4">
                    <div className="flex items-center gap-3 pb-3 border-b">
                      <div className="w-10 h-10 rounded-full bg-glovo-yellow flex items-center justify-center font-extrabold">
                        {lead.name
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{lead.name}</div>
                        <div className="text-xs text-gray-500">
                          {lead.role} • {lead.team}
                        </div>
                      </div>
                      <Badge color="green">{members.length}</Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      {members.length === 0 && <div className="text-xs text-gray-400 py-2">Aucun picker rattaché.</div>}
                      {members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 text-sm py-1">
                          <span className="truncate">
                            {m.name} <span className="text-[10px] text-gray-400">{m.role !== 'Picker' && m.role}</span>
                          </span>
                          <LeadSelect u={m} />
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
                {g.orphans.length > 0 && (
                  <Card className="p-4 border-glovo-red">
                    <div className="font-bold text-glovo-red pb-2 border-b">Non rattachés ({g.orphans.length})</div>
                    {g.orphans.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 text-sm py-1">
                        <span className="truncate">{m.name}</span>
                        <LeadSelect u={m} />
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={isNew ? 'Ajouter un agent' : 'Modifier un agent'}>
        {edit && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ID Glovo">
                <Input value={edit.id} disabled={!isNew} onChange={(e) => setEdit({ ...edit, id: e.target.value.replace(/\s/g, '') })} />
              </Field>
              <Field label="Store">
                <Select
                  value={edit.store}
                  disabled={scope !== 'ALL'}
                  onChange={(e) => {
                    const st = e.target.value as StoreId;
                    setEdit({ ...edit, store: st, team: LEAD_TEAMS[st][0], leadId: leadsOf(st)[0]?.id });
                  }}
                >
                  {db.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Nom et Prénoms">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Fonction">
              <Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role, level: defaultLevel(e.target.value as Role, edit.store) })}>
                {AGENT_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
            {isLead(edit.role) ? (
              <Field label="Équipe encadrée">
                <Select value={edit.team} onChange={(e) => setEdit({ ...edit, team: e.target.value })}>
                  {LEAD_TEAMS[edit.store as StoreId].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Picker Lead référent" hint="L'équipe (et donc le planning) suit le Picker Lead choisi.">
                <Select value={edit.leadId || ''} onChange={(e) => setEdit({ ...edit, leadId: e.target.value || undefined })}>
                  <option value="">— Non rattaché —</option>
                  {leadsOf(edit.store).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.team})
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {isNew && (
              <Field label="Code PIN initial" hint="Modifiable ensuite dans « Utilisateurs & Accès ».">
                <Input value={edit.pin} maxLength={4} onChange={(e) => setEdit({ ...edit, pin: e.target.value.replace(/\D/g, '') })} />
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-2">
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
