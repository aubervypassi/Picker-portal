import { useState } from 'react';
import { Copy, Download, Eye, EyeOff, KeyRound, Printer, RefreshCw, Search, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, useConfirm, useUI } from '../components/ui';
import { defaultLevel, defaultTeam, randomPin } from '../data/seed';
import { isLead, lvl } from '../lib/utils';
import { ALL_ROLES, LEVELS, type Level, type Role, type StoreId, type User } from '../types';

const LEVEL_RIGHTS: Record<Level, string> = {
  1: 'Lecture planning, pointage photo + GPS, paie perso, formations, requêtes et explications.',
  2: 'Niveau 1 + édition du planning du store, journal de pointage et rapports de shift.',
  3: 'Gestion complète de son store : effectifs, accès, validations, explications, formations.',
  4: 'Contrôle global de tous les stores, barèmes de paie et paramètres système.',
};
const levelColor = (l: Level) => (['gray', 'blue', 'yellow', 'green'] as const)[l - 1];

const genPassword = () => {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join('');
};
const uniquePin = () => {
  let p = randomPin();
  while (/^(\d)\1{3}$/.test(p) || '0123456789'.includes(p) || '9876543210'.includes(p)) p = randomPin();
  return p;
};

export default function Access({ scope }: PageProps) {
  const { db, me: meMaybe, update, notify } = useDB();
  const me = meMaybe!;
  const ui = useUI();
  const { confirm, node } = useConfirm();
  const myLevel = lvl(me);
  const [store, setStore] = useState<StoreId | 'ALL'>(scope === 'ALL' ? 'ABN' : scope);
  const effStore = scope === 'ALL' ? store : scope;
  const [reveal, setReveal] = useState(false);
  const [q, setQ] = useState('');
  const [manual, setManual] = useState<User | null>(null);
  const [pinVal, setPinVal] = useState('');
  const [create, setCreate] = useState<User | null>(null);

  const stName = (s: string) => (s === 'ALL' ? 'Tous les stores' : db.stores.find((x) => x.id === s)?.name || s);
  const list = db.users
    .filter((u) => u.store === effStore)
    .filter((u) => !q || (u.name + u.id + u.role).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => lvl(b) - lvl(a) || a.name.localeCompare(b.name));
  const canTouch = (u: User) => u.id !== me.id && lvl(u) <= myLevel && (myLevel === 4 || lvl(u) < 4);
  const isPwd = (u: User) => lvl(u) >= 3;

  const patch = (id: string, p: Partial<User>) =>
    update((d) => {
      const u = d.users.find((x) => x.id === id);
      if (u) Object.assign(u, p);
    });

  const sheet = () =>
    `PICKER PORTAL — Identifiants ${stName(effStore)}\n` +
    list
      .filter((u) => u.status === 'Actif' && !isPwd(u) && u.pin)
      .map((u) => `${u.name} | ID : ${u.id} | PIN : ${u.pin}`)
      .join('\n');

  const leadsOf = (st: string) => db.users.filter((u) => u.store === st && isLead(u.role) && u.status === 'Actif');

  const openCreate = () => {
    const st = (effStore === 'ALL' ? 'ABN' : effStore) as StoreId;
    setCreate({ id: '', name: '', role: 'Picker', store: st, team: '', leadId: leadsOf(st)[0]?.id, pin: uniquePin(), level: 1, status: 'Actif' });
  };

  const saveCreate = () => {
    if (!create) return;
    const c = { ...create, id: create.id.trim(), name: create.name.trim() };
    if (!c.id || !c.name) return ui.toast('ID et nom obligatoires', 'err');
    if (db.users.some((u) => u.id.toLowerCase() === c.id.toLowerCase())) return ui.toast('Cet identifiant existe déjà', 'err');
    if (c.level > myLevel) return ui.toast('Vous ne pouvez pas attribuer un niveau supérieur au vôtre', 'err');
    if (c.level >= 3 ? c.pin.length < 6 : !/^\d{4}$/.test(c.pin)) return ui.toast(c.level >= 3 ? 'Mot de passe : 6 caractères minimum' : 'Le PIN doit comporter 4 chiffres', 'err');
    if (c.store === 'ALL' && c.level < 4) return ui.toast('« Tous les stores » est réservé au Niveau 4 (Super Admin)', 'err');
    if (c.level === 4) c.store = 'ALL';
    if (c.role === 'Store Manager') {
      c.team = '';
      c.leadId = undefined;
    } else {
      c.team = c.role === 'Picker Hub' ? 'Hub' : c.role.includes('Inbound') ? 'Inbound' : defaultTeam(c.store as StoreId, c.role, db.users.filter((u) => u.store === c.store).length);
      if (isLead(c.role)) c.leadId = undefined;
      else {
        const l = db.users.find((u) => u.id === c.leadId);
        if (l && c.role === 'Picker') c.team = l.team;
      }
    }
    update((d) => {
      d.users.push(c);
    });
    ui.toast(`${c.name} créé — ${c.level >= 3 ? 'mot de passe' : 'PIN'} : ${c.pin}`);
    setCreate(null);
  };

  return (
    <div>
      {node}
      <PageHeader
        title="Utilisateurs & Accès"
        subtitle="Les PIN sont stockés dans Supabase et ne sont affichés qu'au moment où ils sont générés ou définis"
        icon={KeyRound}
        actions={
          <>
            <Button icon={UserPlus} onClick={openCreate}>
              Créer un utilisateur
            </Button>
            <Button variant="outline" icon={reveal ? EyeOff : Eye} onClick={() => setReveal(!reveal)}>
              {reveal ? 'Masquer' : 'Afficher'}
            </Button>
            {effStore !== 'ALL' && (
              <>
                <Button
                  variant="outline"
                  icon={RefreshCw}
                  onClick={() =>
                    confirm(`Régénérer tous les PIN des agents de ${stName(effStore)} ? Les anciens codes ne fonctionneront plus.`, () => {
                      update((d) => d.users.forEach((u) => u.store === effStore && lvl(u) <= 2 && (u.pin = uniquePin())));
                      ui.toast('Tous les PIN ont été régénérés');
                    })
                  }
                >
                  Tout régénérer
                </Button>
                <Button variant="outline" icon={Copy} onClick={() => ui.copyText(sheet(), 'Fiche des identifiants copiée')}>
                  Copier la fiche
                </Button>
                <Button
                  variant="outline"
                  icon={Download}
                  onClick={() =>
                    ui.exportCSV(`identifiants_${effStore}.csv`, [
                      ['Store', 'ID', 'Nom et Prénoms', 'Fonction', 'Niveau', 'PIN', 'Statut'],
                      ...list.filter((u) => !isPwd(u)).map((u) => [stName(u.store), u.id, u.name, u.role, LEVELS[lvl(u)], u.pin, u.status]),
                    ])
                  }
                >
                  CSV
                </Button>
                <Button variant="outline" icon={Printer} onClick={() => ui.printPage(`Identifiants ${stName(effStore)}`)}>
                  Fiches PDF
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {([1, 2, 3, 4] as Level[]).map((l) => (
          <Card key={l} className="p-3">
            <Badge color={levelColor(l) as any}>{LEVELS[l]}</Badge>
            <p className="text-[11px] text-gray-500 mt-1.5">{LEVEL_RIGHTS[l]}</p>
            <div className="text-xs font-bold mt-1">{db.users.filter((u) => lvl(u) === l && (scope === 'ALL' || u.store === scope)).length} compte(s)</div>
          </Card>
        ))}
      </div>

      <Card className="p-3 mb-4 grid sm:grid-cols-2 gap-2">
        <Select value={effStore} disabled={scope !== 'ALL'} onChange={(e) => setStore(e.target.value as any)}>
          {db.stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          {myLevel >= 4 && <option value="ALL">Tous les stores (Super Admins)</option>}
        </Select>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Nom et Prénoms</th>
                <th className="px-4 py-3">Fonction</th>
                <th className="px-4 py-3">Habilitation</th>
                <th className="px-4 py-3">PIN / mot de passe</th>
                <th className="px-4 py-3">Accès</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const ok = canTouch(u);
                return (
                  <tr key={u.id} className={`border-t ${u.status === 'Suspendu' ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-2.5 font-mono">{u.id}</td>
                    <td className="px-4 py-2.5 font-semibold">
                      {u.name} {u.id === me.id && <Badge color="blue">vous</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{u.role}</td>
                    <td className="px-4 py-2.5">
                      {ok ? (
                        <select
                          value={lvl(u)}
                          onChange={(e) => {
                            const l = Number(e.target.value) as Level;
                            if (l === 4 && u.store !== 'ALL') return ui.toast('Le Niveau 4 nécessite un compte « Tous les stores » : créez un compte Super Admin.', 'err');
                            if (l >= 3 && lvl(u) < 3) return ui.toast('Pour un niveau Store Manager, créez un compte dédié avec mot de passe.', 'err');
                            if (l < 3 && lvl(u) >= 3) return ui.toast('Un compte Store Manager ne peut pas descendre sous le Niveau 3.', 'err');
                            patch(u.id, { level: l });
                            ui.toast('Habilitation mise à jour');
                          }}
                          className="text-xs rounded-lg border border-gray-300 px-2 py-1"
                        >
                          {([1, 2, 3, 4] as Level[])
                            .filter((l) => l <= myLevel)
                            .map((l) => (
                              <option key={l} value={l}>
                                {LEVELS[l]}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <Badge color={levelColor(lvl(u)) as any}>{LEVELS[lvl(u)]}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold tracking-widest">
                      {reveal && ok && u.pin ? u.pin : reveal && ok ? <span className="text-[10px] font-sans font-normal tracking-normal text-gray-400">protégé — Générer / Définir</span> : isPwd(u) ? '••••••••' : '••••'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge color={u.status === 'Actif' ? 'green' : 'red'}>{u.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-1">
                      {ok && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            icon={RefreshCw}
                            onClick={() => {
                              const p = isPwd(u) ? genPassword() : uniquePin();
                              patch(u.id, { pin: p });
                              notify([u.id], `Votre ${isPwd(u) ? 'mot de passe' : 'code PIN'} a été réinitialisé.`);
                              ui.toast(`Nouveau ${isPwd(u) ? 'mot de passe' : 'PIN'} pour ${u.name} : ${p}`);
                            }}
                          >
                            Générer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setManual(u);
                              setPinVal('');
                            }}
                          >
                            Définir
                          </Button>
                          <Button
                            size="sm"
                            variant={u.status === 'Actif' ? 'danger' : 'green'}
                            icon={u.status === 'Actif' ? ShieldOff : ShieldCheck}
                            onClick={() => {
                              patch(u.id, { status: u.status === 'Actif' ? 'Suspendu' : 'Actif' });
                              ui.toast(u.status === 'Actif' ? `Accès de ${u.name} suspendu` : `Accès de ${u.name} réactivé`);
                            }}
                          >
                            {u.status === 'Actif' ? 'Suspendre' : 'Activer'}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Création d'utilisateur */}
      <Modal open={!!create} onClose={() => setCreate(null)} title="Créer un utilisateur">
        {create && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ID (ID Glovo ou identifiant)">
                <Input value={create.id} onChange={(e) => setCreate({ ...create, id: e.target.value.replace(/\s/g, '') })} />
              </Field>
              <Field label="Store">
                <Select
                  value={create.store}
                  disabled={myLevel < 4}
                  onChange={(e) => {
                    const st = e.target.value as StoreId | 'ALL';
                    const role: Role = st === 'ALL' ? 'Store Manager' : create.role;
                    const level = defaultLevel(role, st);
                    setCreate({ ...create, store: st, role, level, leadId: leadsOf(st)[0]?.id, pin: level >= 3 ? genPassword() : create.pin.length === 4 ? create.pin : uniquePin() });
                  }}
                >
                  {db.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  {myLevel >= 4 && <option value="ALL">Tous les stores</option>}
                </Select>
              </Field>
            </div>
            <Field label="Nom et Prénoms">
              <Input value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Profil / Fonction">
                <Select
                  value={create.role}
                  onChange={(e) => {
                    const role = e.target.value as Role;
                    const level = Math.min(defaultLevel(role, create.store), myLevel) as Level;
                    setCreate({ ...create, role, level, pin: level >= 3 ? (create.pin.length >= 6 ? create.pin : genPassword()) : /^\d{4}$/.test(create.pin) ? create.pin : uniquePin() });
                  }}
                >
                  {ALL_ROLES.filter((r) => (create.store === 'ALL' ? r === 'Store Manager' : true))
                    .filter((r) => r !== 'Store Manager' || myLevel >= 3)
                    .map((r) => (
                      <option key={r} value={r}>
                        {r === 'Store Manager' ? 'Store Manager (Admin)' : r}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Niveau d'habilitation">
                <Select
                  value={create.level}
                  onChange={(e) => {
                    const level = Number(e.target.value) as Level;
                    const role: Role = level >= 3 ? 'Store Manager' : create.role === 'Store Manager' ? (level === 2 ? 'Picker Lead Outbound' : 'Picker') : create.role;
                    setCreate({ ...create, level, role, store: level === 4 ? 'ALL' : create.store === 'ALL' ? 'ABN' : create.store, pin: level >= 3 ? (create.pin.length >= 6 ? create.pin : genPassword()) : /^\d{4}$/.test(create.pin) ? create.pin : uniquePin() });
                  }}
                >
                  {([1, 2, 3, 4] as Level[])
                    .filter((l) => l <= myLevel)
                    .map((l) => (
                      <option key={l} value={l}>
                        {LEVELS[l]}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            <p className="text-[11px] text-gray-500 bg-gray-50 rounded-lg p-2">{LEVEL_RIGHTS[create.level]}</p>
            {create.role !== 'Store Manager' && !isLead(create.role) && (
              <Field label="Picker Lead référent">
                <Select value={create.leadId || ''} onChange={(e) => setCreate({ ...create, leadId: e.target.value || undefined })}>
                  <option value="">— Non rattaché —</option>
                  {leadsOf(create.store).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.team})
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={create.level >= 3 ? 'Mot de passe (6 caractères min.)' : 'Code PIN individuel (4 chiffres)'}>
              <div className="flex gap-2">
                <Input
                  value={create.pin}
                  maxLength={create.level >= 3 ? 64 : 4}
                  inputMode={create.level >= 3 ? 'text' : 'numeric'}
                  onChange={(e) => setCreate({ ...create, pin: create.level >= 3 ? e.target.value : e.target.value.replace(/\D/g, '') })}
                  className="font-mono"
                />
                <Button variant="outline" icon={RefreshCw} onClick={() => setCreate({ ...create, pin: create.level >= 3 ? genPassword() : uniquePin() })} aria-label="Générer" />
              </div>
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCreate(null)}>
                Annuler
              </Button>
              <Button variant="green" icon={UserPlus} onClick={saveCreate}>
                Créer le compte
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!manual} onClose={() => setManual(null)} title={`Définir ${manual && isPwd(manual) ? 'le mot de passe' : 'le PIN'} — ${manual?.name}`}>
        {manual && (
          <>
            <Input
              autoFocus
              inputMode={isPwd(manual) ? 'text' : 'numeric'}
              maxLength={isPwd(manual) ? 64 : 4}
              value={pinVal}
              onChange={(e) => setPinVal(isPwd(manual) ? e.target.value : e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-[0.3em] font-bold"
              placeholder={isPwd(manual) ? 'mot de passe' : '0000'}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setManual(null)}>
                Annuler
              </Button>
              <Button
                variant="green"
                disabled={isPwd(manual) ? pinVal.length < 6 : pinVal.length !== 4}
                onClick={() => {
                  patch(manual.id, { pin: pinVal });
                  ui.toast('Identifiant enregistré');
                  setManual(null);
                }}
              >
                Enregistrer
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Fiches imprimables */}
      <div className="print-area hidden print:block">
        <h2 className="text-lg font-bold mb-3">Picker Portal — Identifiants {stName(effStore)}</h2>
        <div className="grid grid-cols-3 gap-2">
          {list
            .filter((u) => u.status === 'Actif' && !isPwd(u) && u.pin)
            .map((u) => (
              <div key={u.id} className="border-2 border-dashed border-gray-400 rounded-lg p-3 text-sm break-inside-avoid">
                <div className="font-bold">{u.name}</div>
                <div className="text-xs">{u.role}</div>
                <div className="mt-2">
                  ID : <b className="font-mono">{u.id}</b>
                </div>
                <div>
                  PIN : <b className="font-mono tracking-widest">{u.pin}</b>
                </div>
                <div className="text-[10px] mt-1">Confidentiel — ne pas partager</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
