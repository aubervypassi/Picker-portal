import { createClient } from '@supabase/supabase-js';
import type { DB, Explanation, PickerRequest, Punch, ShiftCode, ShiftReport, User } from '../types';

/* ================== Connexion Supabase ================== */
export const SUPABASE_URL = 'https://qhlhizoeatbrovcvpupm.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_4D0i57eZixBUuB8wgeJ3KA_SGCRY0C0';
export const PHOTO_BUCKET = 'pointages-photos';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* ================== Mapping tables ⇄ modèle de l'application ==================
 * Les noms de colonnes sont définis ici, et uniquement ici. Voir supabase/schema.sql.
 */
type Row = Record<string, any>;
interface Coll<T> {
  table: string;
  select: string;
  order?: { col: string; asc: boolean; limit?: number };
  toRow: (x: T) => Row;
  fromRow: (r: Row) => T;
}

/** Les PIN ne sont jamais relus depuis la base (colonne non sélectionnée) */
export const PICKERS: Coll<User> = {
  table: 'pickers',
  select: 'id,nom,store,fonction,equipe,lead_id,niveau,statut',
  toRow: (u) => ({
    id: u.id,
    nom: u.name,
    store: u.store,
    fonction: u.role,
    equipe: u.team,
    lead_id: u.leadId ?? null,
    niveau: u.level,
    statut: u.status,
    ...(u.pin ? { pin: u.pin } : {}),
  }),
  fromRow: (r) => ({
    id: String(r.id),
    name: r.nom,
    store: r.store,
    role: r.fonction,
    team: r.equipe || '',
    leadId: r.lead_id || undefined,
    level: Number(r.niveau) || 1,
    status: r.statut || 'Actif',
    pin: '',
  }) as User,
};

export const POINTAGES: Coll<Punch> = {
  table: 'pointages',
  select: '*',
  order: { col: 'horodatage', asc: false, limit: 2000 },
  toRow: (p) => ({
    id: p.id,
    picker_id: p.userId,
    store: p.store,
    type: p.type,
    horodatage: p.at,
    latitude: p.lat,
    longitude: p.lng,
    distance_m: p.distance,
    precision_m: p.accuracy,
    photo_url: p.photo,
    simule: !!p.simulated,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    userId: String(r.picker_id),
    store: r.store,
    type: r.type,
    at: r.horodatage,
    lat: r.latitude,
    lng: r.longitude,
    distance: r.distance_m,
    accuracy: r.precision_m,
    photo: r.photo_url || '',
    simulated: !!r.simule,
  }),
};

export const EXPLICATIONS: Coll<Explanation> = {
  table: 'demandes_explication',
  select: '*',
  order: { col: 'cree_le', asc: true },
  toRow: (e) => ({
    id: e.id,
    picker_id: e.userId,
    motif: e.motif,
    details: e.details,
    cree_le: e.createdAt,
    echeance: e.deadline,
    reponse: e.response ?? null,
    repondu_le: e.respondedAt ?? null,
    statut: e.status,
    decision: e.decision ?? null,
    commentaire_admin: e.adminComment ?? null,
    traite_le: e.treatedAt ?? null,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    userId: String(r.picker_id),
    motif: r.motif,
    details: r.details,
    createdAt: r.cree_le,
    deadline: r.echeance,
    response: r.reponse ?? undefined,
    respondedAt: r.repondu_le ?? undefined,
    status: r.statut,
    decision: r.decision ?? undefined,
    adminComment: r.commentaire_admin ?? undefined,
    treatedAt: r.traite_le ?? undefined,
  }),
};

export const REQUETES: Coll<PickerRequest> = {
  table: 'requetes',
  select: '*',
  order: { col: 'cree_le', asc: true },
  toRow: (q) => ({
    id: q.id,
    picker_id: q.userId,
    type: q.type,
    date_debut: q.dateFrom ?? null,
    date_fin: q.dateTo ?? null,
    message: q.message,
    cree_le: q.createdAt,
    statut: q.status,
    note_admin: q.adminNote ?? null,
    maj_le: q.updatedAt ?? null,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    userId: String(r.picker_id),
    type: r.type,
    dateFrom: r.date_debut ?? undefined,
    dateTo: r.date_fin ?? undefined,
    message: r.message,
    createdAt: r.cree_le,
    status: r.statut,
    adminNote: r.note_admin ?? undefined,
    updatedAt: r.maj_le ?? undefined,
  }),
};

export const RAPPORTS: Coll<ShiftReport> = {
  table: 'rapports_shift',
  select: '*',
  order: { col: 'cree_le', asc: true },
  toRow: (r) => ({ id: r.id, store: r.store, auteur_id: r.authorId, date: r.date, shift: r.shift, reponses: r.answers, cree_le: r.createdAt }),
  fromRow: (r) => ({ id: String(r.id), store: r.store, authorId: String(r.auteur_id), date: r.date, shift: r.shift, answers: r.reponses || {}, createdAt: r.cree_le }),
};

/** Planning : une ligne par (store, date, picker, statut).
 *  statut = 'brouillon' (modification manuelle), 'publie' (version visible des agents), 'nuit' (picker de nuit désigné). */
export function planningRows(db: DB): Map<string, Row> {
  const m = new Map<string, Row>();
  const add = (store: string, date: string, picker_id: string, shift: string, statut: string) => {
    const id = `${store}|${date}|${picker_id}|${statut}`;
    m.set(id, { id, store, date, picker_id, shift, statut });
  };
  Object.entries(db.planningOverrides).forEach(([k, v]) => {
    const [s, d, u] = k.split('|');
    add(s, d, u, v, 'brouillon');
  });
  Object.entries(db.publishedDays).forEach(([k, snap]) => {
    const [s, d] = k.split('|');
    Object.entries(snap).forEach(([u, v]) => add(s, d, u, v, 'publie'));
  });
  Object.entries(db.nightOverrides).forEach(([k, u]) => {
    const [s, d] = k.split('|');
    add(s, d, u, 'N', 'nuit');
  });
  return m;
}
export function applyPlanningRows(rows: Row[]) {
  const planningOverrides: Record<string, ShiftCode> = {};
  const publishedDays: Record<string, Record<string, ShiftCode>> = {};
  const nightOverrides: Record<string, string> = {};
  rows.forEach((r) => {
    const date = String(r.date).slice(0, 10);
    const pid = String(r.picker_id);
    if (r.statut === 'brouillon') planningOverrides[`${r.store}|${date}|${pid}`] = r.shift;
    else if (r.statut === 'publie') (publishedDays[`${r.store}|${date}`] ||= {})[pid] = r.shift;
    else if (r.statut === 'nuit') nightOverrides[`${r.store}|${date}`] = pid;
  });
  return { planningOverrides, publishedDays, nightOverrides };
}

/** Paramètres globaux : table `parametres` (cle text, valeur jsonb) */
export const PARAM_KEYS = [
  'stores',
  'pay',
  'courses',
  'results',
  'progress',
  'reportTemplate',
  'notifications',
  'gpsTestMode',
  'glovoExpressLogoUrl',
  'planningPublished',
  'planningDrafts',
] as const;

/** Lecture complète de la base */
export async function fetchAll(): Promise<Partial<DB> & { empty: boolean }> {
  const get = async (table: string, select = '*', order?: Coll<any>['order']) => {
    let q = supabase.from(table).select(select);
    if (order) q = q.order(order.col, { ascending: order.asc });
    if (order?.limit) q = q.limit(order.limit);
    const { data, error } = await q;
    if (error) throw new Error(`${table} : ${error.message}`);
    return (data || []) as Row[];
  };
  const [pk, pt, ex, rq, rp, pl, pa] = await Promise.all([
    get(PICKERS.table, PICKERS.select),
    get(POINTAGES.table, POINTAGES.select, POINTAGES.order),
    get(EXPLICATIONS.table, '*', EXPLICATIONS.order),
    get(REQUETES.table, '*', REQUETES.order),
    get(RAPPORTS.table, '*', RAPPORTS.order),
    get('plannings'),
    get('parametres'),
  ]);
  const params: Partial<DB> = {};
  pa.forEach((r) => {
    if ((PARAM_KEYS as readonly string[]).includes(r.cle)) (params as any)[r.cle] = r.valeur;
  });
  return {
    empty: pk.length === 0,
    users: pk.map(PICKERS.fromRow),
    punches: pt.map(POINTAGES.fromRow).reverse(),
    explanations: ex.map(EXPLICATIONS.fromRow),
    requests: rq.map(REQUETES.fromRow),
    reports: rp.map(RAPPORTS.fromRow),
    ...applyPlanningRows(pl),
    ...params,
  };
}

/** Écrit dans Supabase uniquement ce qui a changé entre deux états */
export async function syncDiff(prev: DB, next: DB) {
  const ops: Promise<any>[] = [];
  const run = (p: PromiseLike<{ error: any }>, table: string) =>
    ops.push(
      Promise.resolve(p).then(({ error }) => {
        if (error) throw new Error(`${table} : ${error.message}`);
      }),
    );

  const diffColl = <T extends { id: string }>(c: Coll<T>, a: T[], b: T[]) => {
    const before = new Map(a.map((x) => [x.id, JSON.stringify(c.toRow(x))]));
    const upserts = b.map(c.toRow).filter((r) => before.get(r.id) !== JSON.stringify(r));
    const ids = new Set(b.map((x) => x.id));
    const removed = a.filter((x) => !ids.has(x.id)).map((x) => x.id);
    if (upserts.length) run(supabase.from(c.table).upsert(upserts), c.table);
    if (removed.length) run(supabase.from(c.table).delete().in('id', removed), c.table);
  };
  diffColl(PICKERS, prev.users, next.users);
  diffColl(POINTAGES, prev.punches, next.punches);
  diffColl(EXPLICATIONS, prev.explanations, next.explanations);
  diffColl(REQUETES, prev.requests, next.requests);
  diffColl(RAPPORTS, prev.reports, next.reports);

  const pa = planningRows(prev);
  const pb = planningRows(next);
  const up = [...pb.values()].filter((r) => JSON.stringify(pa.get(r.id)) !== JSON.stringify(r));
  const del = [...pa.keys()].filter((k) => !pb.has(k));
  for (let i = 0; i < up.length; i += 500) run(supabase.from('plannings').upsert(up.slice(i, i + 500)), 'plannings');
  for (let i = 0; i < del.length; i += 200) run(supabase.from('plannings').delete().in('id', del.slice(i, i + 200)), 'plannings');

  const params = PARAM_KEYS.filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k])).map((k) => ({ cle: k, valeur: next[k] }));
  if (params.length) run(supabase.from('parametres').upsert(params), 'parametres');

  await Promise.all(ops);
}

/** Vérifie ID + PIN côté serveur (fonction RPC `verifier_pin`, repli : requête directe) */
export async function verifyPin(id: string, pin: string): Promise<boolean> {
  const rpc = await supabase.rpc('verifier_pin', { p_id: id, p_pin: pin });
  if (!rpc.error) return rpc.data === true;
  const { data, error } = await supabase.from('pickers').select('id').eq('id', id).eq('pin', pin).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** Envoie la photo de pointage dans le bucket et renvoie son URL publique */
export async function uploadPhoto(dataUrl: string, path: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}
