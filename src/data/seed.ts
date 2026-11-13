import type { Course, DB, Level, ReportQuestion, Role, Store, StoreId, User } from '../types';
import { GLOVO_EXPRESS_LOGO } from './logo';

export const STORES: Store[] = [
  { id: 'ABN', name: 'ABN - Cocody', lat: 5.3599, lng: -3.981, maps: 'https://maps.app.goo.gl/wC7Yxue5MbUf3iyf9', radius: 100 },
  { id: 'ABJ', name: 'ABJ - Koumassi', lat: 5.2974, lng: -3.9565, maps: 'https://maps.app.goo.gl/ky8MhpVV5Y1wEFWPA', radius: 100 },
];

export const storeIdFromName = (name: string): StoreId | null => {
  const n = (name || '').toLowerCase();
  if (n.includes('abn') || n.includes('cocody')) return 'ABN';
  if (n.includes('abj') || n.includes('koumassi')) return 'ABJ';
  return null;
};

const RAW: { store: string; id: string; name: string; role: Role }[] = [
  { store: 'ABN - Cocody', id: '105607', name: 'Ghislain Blede', role: 'Picker' },
  { store: 'ABN - Cocody', id: '105835', name: 'Sosthene SOKO', role: 'Picker' },
  { store: 'ABN - Cocody', id: '153930', name: "Vivian N'Guessan", role: 'Picker' },
  { store: 'ABN - Cocody', id: '150725', name: 'Yannick Kouabo', role: 'Picker Inbound' },
  { store: 'ABN - Cocody', id: '136346', name: 'Malick Gbane', role: 'Picker Lead Outbound' },
  { store: 'ABN - Cocody', id: '105131', name: 'Kouakou Jekonias', role: 'Picker' },
  { store: 'ABN - Cocody', id: '49312', name: 'Aka Joel Junior', role: 'Picker Lead Outbound' },
  { store: 'ABN - Cocody', id: '101891', name: 'Jules Dan', role: 'Picker' },
  { store: 'ABN - Cocody', id: '101929', name: 'Samuel Kouassi', role: 'Picker Lead Outbound' },
  { store: 'ABN - Cocody', id: '156113', name: 'Kouame Parfait Koffi', role: 'Picker' },
  { store: 'ABN - Cocody', id: '156108', name: 'Wilfried Patrick Bohenan', role: 'Picker' },
  { store: 'ABN - Cocody', id: '8076', name: 'Ben Karamoko', role: 'Picker Lead Inbound' },
  { store: 'ABN - Cocody', id: '158465', name: 'Konan Bekanti Daniel', role: 'Picker Inbound' },
  { store: 'ABN - Cocody', id: '183064', name: 'Israel Oliko', role: 'Picker' },
  { store: 'ABN - Cocody', id: '169576', name: "Boba N'touakeleu Eric Marc Aristide", role: 'Picker' },
  { store: 'ABN - Cocody', id: '169575', name: 'Kanga Kouadio Lazare', role: 'Picker' },
  { store: 'ABN - Cocody', id: '169438', name: 'TAPE Guihounon Marius', role: 'Picker' },
  { store: 'ABN - Cocody', id: '69035', name: 'KOFFI KOUAME ANGE', role: 'Picker' },
  { store: 'ABN - Cocody', id: '168483', name: 'DOUFAND ABDRAMANE JUNIOR', role: 'Picker Inbound' },
  { store: 'ABN - Cocody', id: '168467', name: "Charles N'ZI", role: 'Picker Inbound' },
  { store: 'ABN - Cocody', id: '167493', name: 'Fabrice Blede', role: 'Picker' },
  { store: 'ABN - Cocody', id: '165909', name: 'Boris Abou', role: 'Picker' },
  { store: 'ABN - Cocody', id: '165037', name: 'Paul Kouame', role: 'Picker' },
  { store: 'ABN - Cocody', id: '164467', name: 'Noel Gerard AKA', role: 'Picker' },
  { store: 'ABN - Cocody', id: '162893', name: 'Nathan Ekponon', role: 'Picker' },
  { store: 'ABN - Cocody', id: '162784', name: 'Fidel Konan', role: 'Picker' },
  { store: 'ABN - Cocody', id: '159817', name: 'Hermann Kouame', role: 'Picker' },
  { store: 'ABN - Cocody', id: '186500', name: 'Gnahoré Ange', role: 'Picker' },
  { store: 'ABJ - Koumassi', id: '101642', name: 'Armand Tahi', role: 'Picker' },
  { store: 'ABJ - Koumassi', id: '17364', name: 'Herman Koffi', role: 'Picker Lead Outbound' },
  { store: 'ABJ - Koumassi', id: '15706', name: 'Lionnel Dibi', role: 'Picker' },
  { store: 'ABJ - Koumassi', id: '15704', name: 'Stephane Ange', role: 'Picker Lead Outbound' },
  { store: 'ABJ - Koumassi', id: '17330', name: 'Wilfried Ochima', role: 'Picker' },
  { store: 'ABJ - Koumassi', id: '156886', name: 'Franck Ebrin', role: 'Picker' },
  { store: 'ABJ - Koumassi', id: '157026', name: 'Zamble Wilfried', role: 'Picker' },
  { store: 'ABJ - Koumassi', id: '170184', name: 'Ouattara Hossene', role: 'Picker' },
  { store: 'ABJ - Koumassi', id: '170186', name: 'Ouattara Hassane', role: 'Picker Hub' },
  { store: 'ABJ - Koumassi', id: '182429', name: 'Guy Demers Rodrigue', role: 'Picker Hub' },
  { store: 'ABJ - Koumassi', id: '182430', name: 'Malick Fofana', role: 'Picker Hub' },
];

export const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));

/** Niveau d'habilitation par défaut selon la fonction */
export const defaultLevel = (role: Role, store: StoreId | 'ALL' = 'ABN'): Level =>
  role === 'Store Manager' ? (store === 'ALL' ? 4 : 3) : role.startsWith('Picker Lead') ? 2 : 1;

/** Rattache chaque agent sans leadId au Picker Lead de son équipe (ou au lead le moins chargé du store) */
export function assignLeads(users: User[]) {
  users.forEach((u) => {
    if (u.role === 'Store Manager' || u.role.startsWith('Picker Lead')) return;
    if (u.leadId && users.some((l) => l.id === u.leadId)) return;
    const leads = users.filter((l) => l.store === u.store && l.role.startsWith('Picker Lead'));
    const sameTeam = leads.find((l) => l.team === u.team && u.team !== 'Outbound');
    if (sameTeam) {
      u.leadId = sameTeam.id;
      return;
    }
    const pool = leads.filter((l) => (u.team === 'Inbound' ? l.role === 'Picker Lead Inbound' : l.role === 'Picker Lead Outbound'));
    const cands = pool.length ? pool : leads;
    if (!cands.length) return;
    const load = (l: User) => users.filter((x) => x.leadId === l.id).length;
    u.leadId = cands.slice().sort((a, b) => load(a) - load(b) || a.id.localeCompare(b.id))[0].id;
  });
  return users;
}

/** Équipe par défaut selon le store et la fonction */
export function defaultTeam(store: StoreId, role: Role, indexInGroup: number): string {
  if (role === 'Picker Inbound' || role === 'Picker Lead Inbound') return 'Inbound';
  if (role === 'Picker Hub') return 'Hub';
  if (store === 'ABN') return 'Outbound ' + ['A', 'B', 'C'][indexInGroup % 3];
  return 'Outbound';
}

function seedUsers(): User[] {
  const counters: Record<string, number> = {};
  const users: User[] = RAW.map((r) => {
    const store = storeIdFromName(r.store)!;
    const key = store + r.role;
    const idx = counters[key] ?? 0;
    counters[key] = idx + 1;
    return {
      id: r.id,
      name: r.name,
      role: r.role,
      store,
      team: defaultTeam(store, r.role, idx),
      pin: randomPin(),
      level: defaultLevel(r.role, store),
      status: 'Actif',
    };
  });
  users.unshift({
    id: 'admin',
    name: 'Super Admin',
    role: 'Store Manager',
    store: 'ALL',
    team: '',
    pin: 'Glovo2026',
    level: 4,
    status: 'Actif',
  });
  return assignLeads(users);
}

const COURSES: Course[] = [
  {
    id: 'c-onboarding',
    title: 'Bienvenue chez Glovo : le métier de Picker',
    description: "Les bases du rôle de Picker dans un MFC Glovo : missions, indicateurs et comportement attendu.",
    createdAt: new Date().toISOString(),
    sections: [
      {
        title: 'Ta mission',
        content:
          "Le Picker prépare les commandes des clients dans le MFC (Micro-Fulfillment Center). Chaque commande doit être complète, exacte et prête dans le temps imparti pour que le rider puisse partir immédiatement.",
      },
      {
        title: 'Les indicateurs clés',
        content:
          "Tu es évalué sur la vitesse de préparation (temps de picking), la précision (zéro article manquant ou erroné) et la qualité (produits frais en bon état, emballage soigné). Les commandes oubliées ou incomplètes impactent directement la note client.",
      },
      {
        title: 'Ponctualité et pointage',
        content:
          "Le pointage se fait au store, à moins de 100 m, avec une photo prise sur place. Arrive 10 minutes avant ton shift. Toute absence doit être signalée à l'avance via le module Requêtes.",
      },
    ],
    quiz: [
      { q: "Quel est le rôle principal d'un Picker ?", options: ['Livrer les commandes', 'Préparer les commandes de façon complète et exacte', 'Gérer les fournisseurs', 'Encaisser les clients'], answer: 1 },
      { q: 'Quel indicateur mesure les articles manquants ou erronés ?', options: ['La vitesse', 'La précision', 'Le chiffre d’affaires', 'Le nombre de riders'], answer: 1 },
      { q: 'À quelle distance maximale du store peut-on pointer ?', options: ['50 m', '100 m', '500 m', '1 km'], answer: 1 },
      { q: 'Combien de temps avant ton shift dois-tu arriver ?', options: ['À l’heure pile', '10 minutes avant', '1 heure avant', 'Peu importe'], answer: 1 },
      { q: 'Comment signaler une absence ?', options: ['Ne rien dire', 'Via le module Requêtes, à l’avance', 'Par un collègue', 'Après le shift'], answer: 1 },
    ],
  },
  {
    id: 'c-picking',
    title: 'Picking & Qualité : FEFO et produits frais',
    description: 'Appliquer la règle FEFO, contrôler les produits frais et éviter les erreurs de préparation.',
    createdAt: new Date().toISOString(),
    sections: [
      {
        title: 'La règle FEFO',
        content:
          "FEFO signifie « First Expired, First Out » : on prélève toujours en premier le produit dont la date de péremption est la plus proche. Cela réduit le scrapping (produits jetés) et garantit la fraîcheur pour le client.",
      },
      {
        title: 'Contrôle des produits frais',
        content:
          "Vérifie l'aspect, l'odeur et la date des fruits, légumes, produits laitiers et viandes. Un produit abîmé ne doit jamais partir chez le client : signale-le et remplace-le. Les produits froids sont prélevés en dernier.",
      },
      {
        title: 'Emballage et chaîne du froid',
        content:
          "Sépare les produits froids/surgelés des produits secs et chimiques. Utilise les sacs isothermes pour le froid. Les produits lourds vont au fond, les fragiles (œufs, pain) au-dessus.",
      },
    ],
    quiz: [
      { q: 'Que signifie FEFO ?', options: ['First Entered, First Out', 'First Expired, First Out', 'Fast Express Food Order', 'Fresh Every Friday Only'], answer: 1 },
      { q: 'Quel produit prélever en premier selon FEFO ?', options: ['Le plus récent', 'Celui dont la date de péremption est la plus proche', 'Le plus cher', 'Le plus accessible'], answer: 1 },
      { q: 'À quel moment prélever les produits froids ?', options: ['En premier', 'En dernier', 'Au milieu', 'Peu importe'], answer: 1 },
      { q: 'Où placer les œufs dans le sac ?', options: ['Au fond', 'Au-dessus', 'Avec les produits chimiques', 'Dans le sac isotherme seulement'], answer: 1 },
      { q: 'Que faire d’un produit frais abîmé ?', options: ['L’envoyer quand même', 'Le signaler et le remplacer', 'Le cacher', 'Baisser le prix'], answer: 1 },
    ],
  },
  {
    id: 'c-securite',
    title: 'Sécurité & Hygiène au MFC',
    description: 'Les règles de sécurité, d’hygiène et de gestion des frigos/congélateurs.',
    createdAt: new Date().toISOString(),
    sections: [
      {
        title: 'Hygiène personnelle',
        content:
          "Lave-toi les mains en début de shift, après une pause et après manipulation de déchets. La tenue Glovo doit être propre. Bijoux et nourriture personnelle sont interdits dans la zone de picking.",
      },
      {
        title: 'Frigos et congélateurs',
        content:
          "Les frigos doivent rester entre 0 °C et 4 °C, les congélateurs à -18 °C ou moins. Ferme toujours les portes immédiatement. Toute anomalie de température est notée dans le rapport de shift et signalée au Picker Lead.",
      },
      {
        title: 'Sécurité dans les allées',
        content:
          "Les allées restent dégagées : pas de cartons au sol. Les charges lourdes se soulèvent jambes fléchies, dos droit. En cas d'incident, préviens immédiatement le Picker Lead.",
      },
    ],
    quiz: [
      { q: 'Quelle température pour un frigo ?', options: ['Entre 0 °C et 4 °C', 'Entre 8 °C et 12 °C', '-18 °C', 'Température ambiante'], answer: 0 },
      { q: 'Quelle température pour un congélateur ?', options: ['0 °C', '-5 °C', '-18 °C ou moins', '4 °C'], answer: 2 },
      { q: 'Quand se laver les mains ?', options: ['Une fois par semaine', 'En début de shift, après la pause et après les déchets', 'Jamais', 'Seulement en fin de shift'], answer: 1 },
      { q: 'Comment soulever une charge lourde ?', options: ['Dos courbé', 'Jambes fléchies, dos droit', 'D’une seule main', 'En courant'], answer: 1 },
      { q: 'Où noter une anomalie de température ?', options: ['Nulle part', 'Dans le rapport de shift', 'Sur un carton', 'Sur WhatsApp uniquement'], answer: 1 },
    ],
  },
];

export const DEFAULT_TEMPLATE: ReportQuestion[] = [
  { id: 'scrap', label: 'Scrapping effectué (produits périmés/abîmés retirés) ?', type: 'ouinon', required: true },
  { id: 'scrap_qte', label: "Nombre d'articles scrappés", type: 'nombre', required: true, cond: { q: 'scrap', v: 'Oui' } },
  { id: 'proprete', label: 'Propreté de la zone de picking', type: 'note', required: true },
  { id: 'retours', label: 'Retours de stocks traités et rangés ?', type: 'ouinon', required: true },
  { id: 'retours_detail', label: 'Pourquoi les retours ne sont pas traités ?', type: 'texte', required: true, cond: { q: 'retours', v: 'Non' } },
  { id: 'frigos', label: 'Frigos à la bonne température (0–4 °C) ?', type: 'ouinon', required: true },
  { id: 'frigos_detail', label: 'Détail de l’anomalie frigo (température relevée, frigo concerné)', type: 'texte', required: true, cond: { q: 'frigos', v: 'Non' } },
  { id: 'congel', label: 'Congélateurs à -18 °C ou moins ?', type: 'ouinon', required: true },
  { id: 'congel_detail', label: 'Détail de l’anomalie congélateur', type: 'texte', required: true, cond: { q: 'congel', v: 'Non' } },
  { id: 'presence', label: "Présence de l'équipe", type: 'presence', required: true },
  { id: 'oublis', label: 'Nombre de commandes oubliées', type: 'nombre', required: true },
  { id: 'oublis_motif', label: 'Motif des commandes oubliées', type: 'choix', options: ['Rupture de stock', 'Erreur de picking', 'Commande non vue', 'Problème système', 'Autre'], required: true, cond: { q: 'oublis', v: '> 0' } },
  { id: 'comment', label: 'Commentaires', type: 'texte', required: false },
];

export function createSeed(): DB {
  return {
    version: 3,
    stores: STORES.map((s) => ({ ...s })),
    users: seedUsers(),
    pay: { rateAgent: 577, rateLead: 750, overtime: 15, night: 75, holiday: 100, holidayNight: 175 },
    planningOverrides: {},
    publishedDays: {},
    planningPublished: {},
    planningDrafts: {},
    nightOverrides: {},
    progress: {},
    glovoExpressLogoUrl: GLOVO_EXPRESS_LOGO,
    punches: [],
    courses: COURSES,
    results: [],
    explanations: [],
    requests: [],
    reportTemplate: DEFAULT_TEMPLATE,
    reports: [],
    notifications: [],
    gpsTestMode: false,
  };
}

/** Migration d'une base v2 (déjà en service) vers v3 sans perte de données */
export function migrate(old: any): DB {
  const base = createSeed();
  if (old?.version === 3) return { ...base, ...old };
  if (old?.version !== 2) return base;
  const users: User[] = (old.users || []).map((u: any) => {
    const role: Role = u.role === 'Administrateur' ? 'Store Manager' : u.role;
    const pin = u.role === 'Administrateur' ? old.adminPassword || 'Glovo2026' : u.pin;
    return { ...u, role, pin, level: defaultLevel(role, u.store) } as User;
  });
  // Anciennes surcharges `${store}|${lundi}|${user}|${jour}` → `${store}|${date}|${user}`
  const planningOverrides: Record<string, any> = {};
  Object.entries(old.planningOverrides || {}).forEach(([k, v]) => {
    const [st, monday, uid, dow] = k.split('|');
    const [y, m, d] = monday.split('-').map(Number);
    const dt = new Date(y, m - 1, d + Number(dow));
    const key = `${st}|${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}|${uid}`;
    planningOverrides[key] = v;
  });
  const { adminPassword: _a, ...rest } = old;
  return { ...base, ...rest, version: 3, users: assignLeads(users), planningOverrides, nightOverrides: {}, publishedDays: {}, planningPublished: {} };
}
