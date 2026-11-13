import type { DB, Level, Role, ShiftCode, StoreId, User } from '../types';

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const isLead = (r: Role) => r === 'Picker Lead Outbound' || r === 'Picker Lead Inbound';

export const fcfa = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' FCFA';

export const isSandboxed = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

/* ---------------- Dates ---------------- */
export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const mondayOf = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // 0 = lundi
  return addDays(x, -day);
};
const EPOCH = new Date(2026, 0, 5); // un lundi de référence pour les rotations
export const dayNumber = (d: Date) => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - EPOCH.getTime()) / 86400000);
export const weekNumber = (monday: Date) => Math.floor(dayNumber(monday) / 7);
export const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const fmtDate = (s: string | Date) =>
  new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const fmtDateTime = (s: string | Date) =>
  new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const fmtTime = (s: string | Date) => new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/* ---------------- GPS ---------------- */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ---------------- Images ---------------- */
export function compressImage(file: File, max = 480, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture impossible'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image invalide'));
      img.onload = () => {
        const ratio = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        // Tampon horodaté sur la photo
        const stamp = new Date().toLocaleString('fr-FR');
        ctx.font = `${Math.max(11, Math.round(c.width / 28))}px sans-serif`;
        const h = Math.max(16, Math.round(c.width / 20));
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, c.height - h, c.width, h);
        ctx.fillStyle = '#FFC244';
        ctx.fillText('Picker Portal • ' + stamp, 6, c.height - h / 3);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------- CSV ---------------- */
export function toCSV(rows: (string | number)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? '');
          return /[;"\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(';'),
    )
    .join('\n');
}

/* ---------------- Habilitations (RBAC) ---------------- */
export const lvl = (u?: User | null) => (u?.level ?? 1) as Level;
/** Niveau 3+ : Store Manager / Super Admin */
export const isManager = (u?: User | null) => lvl(u) >= 3;
/** Niveau 4 : Super Admin multi-stores */
export const isSuper = (u?: User | null) => lvl(u) >= 4;
/** Les comptes Store Manager ne font pas partie des effectifs planifiés */
export const isStaff = (u: User) => u.role !== 'Store Manager';
/** Destinataires des notifications de gestion pour un store */
export const managersOf = (db: DB, store: StoreId | 'ALL') =>
  db.users.filter((u) => u.status === 'Actif' && lvl(u) >= 3 && (lvl(u) === 4 || store === 'ALL' || u.store === store)).map((u) => u.id);

/* ---------------- Planning ---------------- */
type CodeInfo = { label: string; name: string; hours: string; cls: string; worked: number; night: number };
export const SHIFT_INFO: Record<Exclude<ShiftCode, ''>, CodeInfo> = {
  M: { label: '0800 - 1600', name: 'Matin', hours: '0800 - 1600', cls: 'bg-amber-100 text-amber-900 border-amber-300', worked: 8, night: 0 },
  S: { label: '1600 - 0000', name: 'Soir', hours: '1600 - 0000', cls: 'bg-sky-100 text-sky-900 border-sky-300', worked: 8, night: 0 },
  N: { label: '0000 - 0800', name: 'Nuit', hours: '0000 - 0800', cls: 'bg-indigo-700 text-white border-indigo-800', worked: 8, night: 8 },
  H: { label: '0800 - 1700', name: 'Hub', hours: '0800 - 1700', cls: 'bg-violet-100 text-violet-900 border-violet-300', worked: 8, night: 0 },
  I: { label: '0800 - 1600', name: 'Inbound', hours: '0800 - 1600', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300', worked: 8, night: 0 },
  R: { label: 'Repos', name: 'Repos', hours: '', cls: 'bg-gray-100 text-gray-500 border-gray-200', worked: 0, night: 0 },
  C: { label: 'Congés', name: 'Congés', hours: '', cls: 'bg-orange-100 text-orange-800 border-orange-300', worked: 0, night: 0 },
  A: { label: 'Absent', name: 'Absent', hours: '', cls: 'bg-red-100 text-red-700 border-red-300', worked: 0, night: 0 },
};
/** Valeurs proposées dans le menu déroulant de chaque cellule */
export const EDIT_CODES: Exclude<ShiftCode, ''>[] = ['M', 'S', 'N', 'H', 'R', 'C', 'A'];
export const SHIFT_ORDER = EDIT_CODES;

const byId = (a: User, b: User) => a.id.localeCompare(b.id, 'fr', { numeric: true });

export function storeAgents(db: DB, store: StoreId, includeSuspended = true) {
  return db.users.filter((u) => u.store === store && isStaff(u) && (includeSuspended || u.status === 'Actif'));
}

/** Équipe effective : déterminée par le Picker Lead référent (leadId) */
export function teamOf(db: DB, u: User): string {
  if (u.role === 'Picker Hub') return 'Hub';
  if (u.role === 'Picker Inbound' || u.role === 'Picker Lead Inbound') return 'Inbound';
  if (u.leadId) {
    const l = db.users.find((x) => x.id === u.leadId && x.store === u.store);
    if (l && l.team) return l.team;
  }
  return u.team || 'Sans équipe';
}

const ABN_CYCLE: ShiftCode[] = ['M', 'S', 'R'];
const mod = (a: number, n: number) => ((a % n) + n) % n;
const abnSlot = (team: string, n: number): ShiftCode | null => {
  const m = /^Outbound ([ABC])$/.exec(team);
  return m ? ABN_CYCLE[mod(n + 'ABC'.indexOf(m[1]), 3)] : null;
};

function nightPool(db: DB, store: StoreId, nDate: Date): { team?: string; members: User[] } {
  const agents = storeAgents(db, store, false).filter((a) => !isLead(a.role));
  if (store === 'ABN') {
    // L'équipe qui fait 1600-0000 la veille fournit le picker de nuit
    const prev = dayNumber(nDate) - 1;
    const k = [0, 1, 2].find((kk) => mod(prev + kk, 3) === 1)!;
    const team = 'Outbound ' + 'ABC'[k];
    return { team, members: agents.filter((a) => teamOf(db, a) === team).sort(byId) };
  }
  return { members: agents.filter((a) => teamOf(db, a) === 'Outbound').sort(byId) };
}

/**
 * Picker de nuit pour la case « 0000 - 0800 » du jour `nDate`.
 * Règle : il est issu de l'équipe du soir de la veille (J) ; sa case J est « Repos »,
 * sa case J+1 (= nDate) est « 0000 - 0800 ».
 */
export function nightPicker(db: DB, store: StoreId, nDate: Date): string | null {
  const { members } = nightPool(db, store, nDate);
  const ov = db.nightOverrides[`${store}|${ymd(nDate)}`];
  if (ov && members.some((m) => m.id === ov)) return ov;
  if (!members.length) return null;
  const n = dayNumber(nDate);
  return members[mod(store === 'ABN' ? Math.floor((n - 1) / 3) : n, members.length)].id;
}
export const nightTeam = (db: DB, store: StoreId, nDate: Date) => nightPool(db, store, nDate);

/* --- Solveur hebdomadaire ABJ - Koumassi (2 jours de repos/semaine garantis) --- */
const abjMemo = new WeakMap<DB, Map<string, Record<string, ShiftCode[]>>>();
function abjWeek(db: DB, monday: Date): Record<string, ShiftCode[]> {
  const key = ymd(monday);
  let m = abjMemo.get(db);
  if (!m) abjMemo.set(db, (m = new Map()));
  if (m.has(key)) return m.get(key)!;
  const group = storeAgents(db, 'ABJ', false)
    .filter((a) => !isLead(a.role) && teamOf(db, a) === 'Outbound')
    .sort(byId);
  const wk = weekNumber(monday);
  const codes: Record<string, (ShiftCode | null)[]> = {};
  group.forEach((g) => (codes[g.id] = Array(7).fill(null)));
  // 1. Nuits (case J+1) et repos la veille (case J)
  for (let d = 0; d <= 7; d++) {
    const np = nightPicker(db, 'ABJ', addDays(monday, d));
    if (!np || !codes[np]) continue;
    if (d < 7) codes[np][d] = 'N';
    if (d > 0 && codes[np][d - 1] === null) codes[np][d - 1] = 'R';
  }
  // 2. Compléter à 2 jours de repos par semaine, sur les jours les mieux couverts
  const avail = (d: number) => group.filter((g) => codes[g.id][d] === null).length;
  group.forEach((g, i) => {
    let need = 2 - codes[g.id].filter((c) => c === 'R').length;
    while (need-- > 0) {
      const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => codes[g.id][d] === null);
      if (!days.length) break;
      days.sort((a, b) => avail(b) - avail(a) || mod(a - i - wk, 7) - mod(b - i - wk, 7));
      codes[g.id][days[0]] = 'R';
    }
  });
  // 3. Répartir le reste entre 0800-1600 et 1600-0000 (2 + 2 visés)
  for (let d = 0; d < 7; d++) {
    const free = group.filter((g) => codes[g.id][d] === null).sort((a, b) => mod(group.indexOf(a) + d + wk, group.length) - mod(group.indexOf(b) + d + wk, group.length));
    let cm = 0,
      cs = 0;
    free.forEach((g) => {
      const prev = d > 0 ? codes[g.id][d - 1] : null;
      let pick: ShiftCode = prev === 'S' ? 'S' : prev === 'M' ? 'M' : mod(group.indexOf(g) + wk, 2) === 0 ? 'M' : 'S';
      if (pick === 'M' && cm >= 2 && cs < 2) pick = 'S';
      else if (pick === 'S' && cs >= 2 && cm < 2) pick = 'M';
      if (pick === 'M') cm++;
      else cs++;
      codes[g.id][d] = pick;
    });
  }
  m.set(key, codes as Record<string, ShiftCode[]>);
  return codes as Record<string, ShiftCode[]>;
}

/**
 * Planning automatique d'un agent pour un jour.
 * ABN - Cocody : 3 équipes Outbound (composées par Picker Lead) en cycle Matin → Soir → Repos.
 *   Nuit : un picker de l'équipe du soir (J) est « Repos » en J puis « 0000 - 0800 » en J+1.
 *   Inbound : 0800 - 1600 du lundi au samedi, 2 jours de repos (dimanche + 1 tournant).
 * ABJ - Koumassi : 2 jours de repos/semaine pour tous ; Hub uniquement en 0800 - 1700 ;
 *   pickers répartis 2 matin / 2 soir / 1 nuit selon l'effectif disponible.
 */
export function autoShift(db: DB, store: StoreId, user: User, date: Date): ShiftCode {
  if (user.status !== 'Actif' || !isStaff(user)) return '';
  const n = dayNumber(date);
  const dow = (date.getDay() + 6) % 7;
  const wk = Math.floor(n / 7);
  const agents = storeAgents(db, store, false);
  const team = teamOf(db, user);
  const idxIn = (pred: (a: User) => boolean) => Math.max(0, agents.filter(pred).sort(byId).findIndex((a) => a.id === user.id));

  if (team === 'Inbound') {
    if (dow === 6) return 'R';
    return dow === mod(idxIn((a) => teamOf(db, a) === 'Inbound') + wk, 6) ? 'R' : 'I';
  }

  if (store === 'ABN') {
    const slot = abnSlot(team, n);
    if (!slot) return dow >= 5 ? 'R' : 'M';
    if (!isLead(user.role)) {
      if (slot === 'S' && nightPicker(db, store, addDays(date, 1)) === user.id) return 'R';
      if (slot === 'R' && nightPicker(db, store, date) === user.id) return 'N';
    }
    return slot;
  }

  // ABJ - Koumassi
  if (team === 'Hub') {
    const start = mod(idxIn((a) => teamOf(db, a) === 'Hub') * 2 + wk, 7);
    return dow === start || dow === mod(start + 1, 7) ? 'R' : 'H';
  }
  if (isLead(user.role)) {
    const i = idxIn((a) => isLead(a.role) && teamOf(db, a) !== 'Inbound');
    const start = mod(i * 3 + 5 + wk, 7);
    if (dow === start || dow === mod(start + 1, 7)) return 'R';
    return mod(wk + i, 2) === 0 ? 'M' : 'S';
  }
  const week = abjWeek(db, mondayOf(date));
  return week[user.id]?.[dow] ?? (dow >= 5 ? 'R' : 'M');
}

export const ovKey = (store: string, date: Date, uid: string) => `${store}|${ymd(date)}|${uid}`;

/** Planning de travail (brouillon courant : auto + modifications manuelles) */
export function shiftFor(db: DB, user: User, date: Date): ShiftCode {
  if (user.store === 'ALL') return '';
  const k = ovKey(user.store, date, user.id);
  if (k in db.planningOverrides) return db.planningOverrides[k];
  return autoShift(db, user.store, user, date);
}

/** Planning vu par l'agent : version publiée si elle existe, sinon provisoire */
export function agentShift(db: DB, user: User, date: Date): { code: ShiftCode; published: boolean } {
  const pub = db.publishedDays[`${user.store}|${ymd(date)}`];
  if (pub && user.id in pub) return { code: pub[user.id], published: true };
  return { code: shiftFor(db, user, date), published: false };
}

/* ---------------- Paie ---------------- */
export function rateFor(db: DB, role: Role) {
  return isLead(role) ? db.pay.rateLead : db.pay.rateAgent;
}

/* ---------------- Médias de formation (IndexedDB) ---------------- */
const MEDIA_DB = 'picker-portal-media';
let idbPromise: Promise<IDBDatabase> | null = null;
function openIdb(): Promise<IDBDatabase> {
  if (!idbPromise)
    idbPromise = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(MEDIA_DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('media');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) {
        rej(e);
      }
    });
  return idbPromise;
}
const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(b);
  });

/** Réduit les grosses images (≤ 1280 px) pour économiser l'espace */
async function shrinkImage(blob: Blob): Promise<Blob> {
  if (blob.size < 350_000 || blob.type === 'image/gif' || blob.type === 'image/svg+xml') return blob;
  try {
    const bmp = await createImageBitmap(blob);
    const r = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * r);
    c.height = Math.round(bmp.height * r);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b || blob), 'image/jpeg', 0.82));
  } catch {
    return blob;
  }
}

/** Enregistre un média et renvoie sa référence (« idb:… » ou data: URL de secours pour les petites images) */
export async function putMedia(blob: Blob): Promise<string> {
  const b = blob.type.startsWith('image/') ? await shrinkImage(blob) : blob;
  try {
    const db = await openIdb();
    const id = uid('m');
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').put(b, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return 'idb:' + id;
  } catch {
    if (b.type.startsWith('image/') && b.size < 600_000) return blobToDataUrl(b);
    throw new Error("Stockage des médias indisponible sur cet appareil : utilisez plutôt un lien (URL YouTube / MP4).");
  }
}

const urlCache = new Map<string, string>();
/** Résout une référence média en URL affichable */
export async function mediaUrl(ref: string): Promise<string> {
  if (!ref.startsWith('idb:')) return ref;
  if (urlCache.has(ref)) return urlCache.get(ref)!;
  const db = await openIdb();
  const blob = await new Promise<Blob | undefined>((res, rej) => {
    const r = db.transaction('media').objectStore('media').get(ref.slice(4));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  if (!blob) throw new Error('Média introuvable');
  const url = URL.createObjectURL(blob);
  urlCache.set(ref, url);
  return url;
}

/** Détecte un lien YouTube et renvoie l'URL d'intégration */
export function youtubeEmbed(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}
const isVideoLink = (u: string) => !!youtubeEmbed(u) || /\.(mp4|webm|mov)(\?|$)/i.test(u) || /vimeo\.com/.test(u);

/* ---------------- Import de cours (docx / pptx, texte + images + vidéos) ---------------- */
type ParsedSection = { title: string; content: string; images: string[]; video?: string };
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4' };

function resolvePath(base: string, target: string) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/');
  parts.pop();
  target.split('/').forEach((p) => (p === '..' ? parts.pop() : p !== '.' && parts.push(p)));
  return parts.join('/');
}

export async function parseCourseFile(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<{ title: string; sections: ParsedSection[]; images: number; videos: number }> {
  const JSZip = (await import('jszip')).default;
  const name = file.name.toLowerCase();
  if (name.endsWith('.ppt') || name.endsWith('.doc')) {
    throw new Error('Les anciens formats .ppt/.doc ne sont pas lisibles dans le navigateur. Enregistrez le fichier en .pptx ou .docx puis réimportez-le.');
  }
  const zip = await JSZip.loadAsync(file);
  const parser = new DOMParser();
  const baseTitle = file.name.replace(/\.(docx|pptx)$/i, '').replace(/[_-]+/g, ' ');
  const sections: ParsedSection[] = [];
  let images = 0,
    videos = 0;
  const stored = new Map<string, string>(); // chemin zip → référence média

  const storeZipMedia = async (path: string) => {
    if (stored.has(path)) return stored.get(path)!;
    const f = zip.file(path);
    if (!f) return null;
    const ext = path.split('.').pop()!.toLowerCase();
    const blob = new Blob([await f.async('arraybuffer')], { type: MIME[ext] || 'application/octet-stream' });
    const ref = await putMedia(blob);
    stored.set(path, ref);
    return ref;
  };
  const readRels = async (relsPath: string) => {
    const f = zip.file(relsPath);
    const out: Record<string, { type: string; target: string; external: boolean }> = {};
    if (!f) return out;
    const x = parser.parseFromString(await f.async('text'), 'application/xml');
    Array.from(x.getElementsByTagName('Relationship')).forEach((r) => {
      out[r.getAttribute('Id')!] = { type: r.getAttribute('Type') || '', target: r.getAttribute('Target') || '', external: r.getAttribute('TargetMode') === 'External' };
    });
    return out;
  };
  const attach = async (sec: ParsedSection, basePath: string, rel: { type: string; target: string; external: boolean }) => {
    try {
      if (rel.external) {
        if (isVideoLink(rel.target) && !sec.video) {
          sec.video = rel.target;
          videos++;
        }
        return;
      }
      const path = resolvePath(basePath, rel.target);
      if (/\/(video|media)$/.test(rel.type) && /\.(mp4|webm|mov|m4v)$/i.test(path) && !sec.video) {
        const ref = await storeZipMedia(path);
        if (ref) {
          sec.video = ref;
          videos++;
        }
      } else if (/\/image$/.test(rel.type) && IMG_EXT.test(path)) {
        const ref = await storeZipMedia(path);
        if (ref && !sec.images.includes(ref)) {
          sec.images.push(ref);
          images++;
        }
      }
    } catch {
      /* média ignoré */
    }
  };

  if (name.endsWith('.pptx')) {
    const slides = Object.keys(zip.files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => Number(a.match(/(\d+)\.xml/)![1]) - Number(b.match(/(\d+)\.xml/)![1]));
    for (const [i, s] of slides.entries()) {
      onProgress?.(`Diapositive ${i + 1}/${slides.length}…`);
      const xml = parser.parseFromString(await zip.file(s)!.async('text'), 'application/xml');
      const paras = Array.from(xml.getElementsByTagName('a:p'))
        .map((p) => Array.from(p.getElementsByTagName('a:t')).map((t) => t.textContent).join(''))
        .map((t) => t.trim())
        .filter(Boolean);
      const sec: ParsedSection = { title: (paras[0] || `Diapositive ${i + 1}`).slice(0, 90), content: paras.slice(1).join('\n'), images: [] };
      const rels = await readRels(s.replace('slides/', 'slides/_rels/') + '.rels');
      // seules les relations réellement utilisées dans la diapositive (images, vidéos, liens)
      const raw = await zip.file(s)!.async('text');
      for (const [id, rel] of Object.entries(rels)) if (raw.includes(`"${id}"`)) await attach(sec, s, rel);
      // liens vidéo écrits en clair dans le texte
      const link = paras.join(' ').match(/https?:\/\/\S+/g)?.find(isVideoLink);
      if (link && !sec.video) {
        sec.video = link;
        videos++;
      }
      if (!sec.content && !sec.images.length && !sec.video && paras.length <= 1) {
        if (!paras.length) continue;
        sec.content = paras[0];
      }
      sections.push(sec);
    }
  } else if (name.endsWith('.docx')) {
    const docPath = 'word/document.xml';
    const doc = zip.file(docPath);
    if (!doc) throw new Error('Document Word invalide.');
    onProgress?.('Lecture du document…');
    const rels = await readRels('word/_rels/document.xml.rels');
    const xml = parser.parseFromString(await doc.async('text'), 'application/xml');
    const paras = Array.from(xml.getElementsByTagName('w:p'));
    const hasHeadings = paras.some((p) => /heading|titre|title/i.test(p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || ''));
    let cur: ParsedSection | null = null;
    let count = 0;
    for (const p of paras) {
      const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '';
      const text = Array.from(p.getElementsByTagName('w:t')).map((t) => t.textContent).join('').trim();
      const heading = hasHeadings ? /heading|titre|title/i.test(style) && !!text : !!text && count % 4 === 0;
      if (heading) {
        if (cur && (cur.content || cur.images.length || cur.video)) sections.push(cur);
        cur = hasHeadings ? { title: text.slice(0, 90), content: '', images: [] } : { title: `Partie ${sections.length + 1}`, content: text, images: [] };
      } else {
        if (!cur) cur = { title: baseTitle, content: '', images: [] };
        if (text) cur.content += (cur.content ? '\n' : '') + text;
      }
      if (text) count++;
      // images (a:blip r:embed) et liens (w:hyperlink r:id) du paragraphe
      const ids = [
        ...Array.from(p.getElementsByTagName('a:blip')).map((b) => b.getAttribute('r:embed') || b.getAttribute('r:link')),
        ...Array.from(p.getElementsByTagName('w:hyperlink')).map((h) => h.getAttribute('r:id')),
      ].filter(Boolean) as string[];
      for (const id of ids) if (rels[id]) await attach(cur!, docPath, rels[id]);
      const link = text.match(/https?:\/\/\S+/g)?.find(isVideoLink);
      if (link && cur && !cur.video) {
        cur.video = link;
        videos++;
      }
    }
    if (cur && ((cur as ParsedSection).content || (cur as ParsedSection).images.length)) sections.push(cur);
  } else {
    throw new Error('Format non pris en charge. Utilisez .docx ou .pptx.');
  }
  if (!sections.length) throw new Error('Aucun contenu trouvé dans le fichier.');
  return { title: baseTitle, sections, images, videos };
}

/** Génère automatiquement un QCM « texte à trous » à partir des sections */
export function generateQuiz(sections: { title: string; content: string }[], max = 10) {
  const text = sections.map((s) => s.content).join(' ');
  const words = Array.from(new Set((text.match(/[A-Za-zÀ-ÿ'-]{7,}/g) || []).map((w) => w.toLowerCase())));
  const quiz: { q: string; options: string[]; answer: number }[] = [];
  const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  for (const s of sections) {
    const sentences = s.content.split(/(?<=[.!?])\s+|\n/).map((x) => x.trim()).filter((x) => x.length > 35);
    for (const sentence of sentences.slice(0, 2)) {
      const candidates = sentence.match(/[A-Za-zÀ-ÿ'-]{7,}/g) || [];
      if (!candidates.length) continue;
      const target = candidates.sort((a, b) => b.length - a.length)[0]!;
      const distractors = shuffle(words.filter((w) => w !== target.toLowerCase())).slice(0, 3);
      if (distractors.length < 3) continue;
      const options = shuffle([target.toLowerCase(), ...distractors]);
      quiz.push({
        q: `« ${s.title} » — Complétez : ${sentence.replace(target, '______')}`,
        options,
        answer: options.indexOf(target.toLowerCase()),
      });
      if (quiz.length >= max) return quiz;
    }
  }
  return quiz;
}
