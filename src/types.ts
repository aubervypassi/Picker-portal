export type StoreId = 'ABN' | 'ABJ';

export type Role =
  | 'Store Manager'
  | 'Picker'
  | 'Picker Inbound'
  | 'Picker Hub'
  | 'Picker Lead Outbound'
  | 'Picker Lead Inbound';

export const AGENT_ROLES: Role[] = [
  'Picker',
  'Picker Inbound',
  'Picker Hub',
  'Picker Lead Outbound',
  'Picker Lead Inbound',
];

export interface Store {
  id: StoreId;
  name: string;
  lat: number;
  lng: number;
  maps: string;
  radius: number; // mètres
}

/** Niveaux d'habilitation (RBAC) */
export type Level = 1 | 2 | 3 | 4;
export const LEVELS: Record<Level, string> = {
  1: 'Niveau 1 - Agent (Picker)',
  2: 'Niveau 2 - Superviseur (Picker Lead)',
  3: 'Niveau 3 - Store Manager (Admin Site)',
  4: 'Niveau 4 - Super Admin (Multi-Stores)',
};
export const ALL_ROLES: Role[] = [
  'Picker',
  'Picker Inbound',
  'Picker Hub',
  'Picker Lead Outbound',
  'Picker Lead Inbound',
  'Store Manager',
];

export interface User {
  id: string; // ID Glovo ou identifiant admin
  name: string;
  role: Role;
  store: StoreId | 'ALL';
  team: string; // ex. "Outbound A", "Inbound", "Hub", ""
  /** ID du Picker Lead référent */
  leadId?: string;
  /** PIN à 4 chiffres (agents) ou mot de passe (Store Manager / Super Admin) */
  pin: string;
  level: Level;
  status: 'Actif' | 'Suspendu';
}

/** Codes de shift du planning
 * M 0800-1600 • S 1600-0000 • N 0000-0800 • H 0800-1700 (Hub Koumassi)
 * R Repos • C Congés • A Absent • I = 0800-1600 Inbound (ancien code, conservé) */
export type ShiftCode = 'M' | 'S' | 'N' | 'H' | 'I' | 'R' | 'C' | 'A' | '';

export interface Punch {
  id: string;
  userId: string;
  store: StoreId;
  type: 'ENTRÉE' | 'SORTIE';
  at: string; // ISO
  lat: number;
  lng: number;
  distance: number; // m
  accuracy: number; // m
  photo: string; // dataURL compressée
  simulated?: boolean;
}

export interface PayConfig {
  rateAgent: number;
  rateLead: number;
  overtime: number; // %
  night: number;
  holiday: number;
  holidayNight: number;
}

/** Média : URL http(s), data: URL, ou référence IndexedDB « idb:<id> » */
export interface CourseSection {
  title: string;
  content: string;
  images?: string[];
  video?: string; // lien YouTube, MP4 ou idb:<id>
}
export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
}
export interface Course {
  id: string;
  title: string;
  description: string;
  sections: CourseSection[];
  quiz: QuizQuestion[];
  source?: string;
  createdAt: string;
}
export interface CourseResult {
  userId: string;
  courseId: string;
  score: number; // %
  passed: boolean;
  at: string;
}

export interface Explanation {
  id: string;
  userId: string;
  motif: string;
  details: string;
  createdAt: string;
  deadline: string;
  response?: string;
  respondedAt?: string;
  status: 'En attente' | 'Répondu' | 'Traité';
  decision?: string;
  adminComment?: string;
  treatedAt?: string;
}

export type RequestType = 'permission' | 'absence' | 'commentaire';
export interface PickerRequest {
  id: string;
  userId: string;
  type: RequestType;
  dateFrom?: string;
  dateTo?: string;
  message: string;
  createdAt: string;
  status: 'En attente' | 'Approuvée' | 'Refusée' | 'Reçue' | 'Lu';
  adminNote?: string;
  updatedAt?: string;
}

export type QuestionType = 'ouinon' | 'texte' | 'nombre' | 'choix' | 'note' | 'presence';
export interface ReportQuestion {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
  required: boolean;
  /** Afficher seulement si la question `q` vaut `v` (ouinon/choix) ou est > 0 (nombre, v="> 0") */
  cond?: { q: string; v: string };
}
export interface ShiftReport {
  id: string;
  store: StoreId;
  authorId: string;
  date: string;
  shift: ShiftCode;
  answers: Record<string, any>;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  text: string;
  at: string;
  read: boolean;
}

export interface DB {
  version: number;
  stores: Store[];
  users: User[];
  pay: PayConfig;
  /** clé `${storeId}|${YYYY-MM-DD}|${userId}` → code manuel */
  planningOverrides: Record<string, ShiftCode>;
  /** Planning publié (visible des agents) : clé `${storeId}|${YYYY-MM-DD}` → { userId: code } */
  publishedDays: Record<string, Record<string, ShiftCode>>;
  /** Historique publication / brouillon : clé `${storeId}|${période}` → ISO */
  planningPublished: Record<string, string>;
  planningDrafts: Record<string, string>;
  /** Picker de nuit : clé `${storeId}|${date de la case 0000-0800}` → userId */
  nightOverrides: Record<string, string>;
  /** Progression de lecture : `${userId}|${courseId}` → nb de chapitres vus */
  progress: Record<string, number>;
  glovoExpressLogoUrl: string;
  punches: Punch[];
  courses: Course[];
  results: CourseResult[];
  explanations: Explanation[];
  requests: PickerRequest[];
  reportTemplate: ReportQuestion[];
  reports: ShiftReport[];
  notifications: Notification[];
  gpsTestMode: boolean;
}
