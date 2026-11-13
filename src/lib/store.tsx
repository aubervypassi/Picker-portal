import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import type { DB, User } from '../types';
import { createSeed } from '../data/seed';
import { uid } from './utils';
import { fetchAll, supabase, syncDiff, verifyPin } from './supabase';

const SESSION = 'picker_portal_session'; // seul l'identifiant de session reste sur l'appareil

export type SyncState = 'ok' | 'saving' | 'error';

interface Ctx {
  db: DB;
  update: (fn: (d: DB) => void) => void;
  me: User | null;
  login: (id: string) => void;
  logout: () => void;
  verifyLogin: (id: string, secret: string) => Promise<boolean>;
  notify: (userIds: string[], text: string) => void;
  reset: () => void;
  reload: () => Promise<void>;
  storageOk: boolean;
  sync: SyncState;
  syncError: string;
}

const DBContext = createContext<Ctx>(null as any);

/** Base vide (même forme que createSeed) pour comparer avant le premier envoi */
const emptyLike = (s: DB): DB => ({
  ...s,
  users: [],
  punches: [],
  explanations: [],
  requests: [],
  reports: [],
  planningOverrides: {},
  publishedDays: {},
  nightOverrides: {},
  ...Object.fromEntries(['stores', 'pay', 'courses', 'results', 'progress', 'reportTemplate', 'notifications', 'gpsTestMode', 'glovoExpressLogoUrl', 'planningPublished', 'planningDrafts'].map((k) => [k, undefined])),
} as DB);

export function DBProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const dbRef = useRef<DB | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [sync, setSync] = useState<SyncState>('ok');
  const [syncError, setSyncError] = useState('');
  const pending = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [meId, setMeId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION);
    } catch {
      return null;
    }
  });

  const commit = (next: DB) => {
    dbRef.current = next;
    setDb(next);
  };

  /** File d'écriture : les envois vers Supabase sont faits dans l'ordre */
  const push = useCallback((prev: DB, next: DB) => {
    pending.current++;
    setSync('saving');
    queue.current = queue.current
      .then(() => syncDiff(prev, next))
      .then(() => {
        if (--pending.current === 0) setSync('ok');
        setSyncError('');
      })
      .catch((e) => {
        pending.current--;
        setSync('error');
        setSyncError(e.message || String(e));
      });
  }, []);

  const reload = useCallback(async () => {
    if (pending.current > 0) return; // pas de rechargement pendant un envoi
    const seed = createSeed();
    const remote = await fetchAll();
    if (remote.empty) {
      // Première utilisation : on initialise Supabase avec les 39 agents et les paramètres par défaut
      await syncDiff(emptyLike(seed), seed);
      commit(seed);
      return;
    }
    const { empty: _e, ...data } = remote;
    const cur = dbRef.current;
    // les PIN ne sont jamais relus : on conserve ceux définis pendant cette session
    const pins = new Map((cur?.users || []).filter((u) => u.pin).map((u) => [u.id, u.pin]));
    const users = (data.users || []).map((u) => ({ ...u, pin: pins.get(u.id) || '' }));
    commit({ ...seed, ...data, users, version: 3 } as DB);
  }, []);

  useEffect(() => {
    reload().catch((e) => setLoadErr(e.message || String(e)));
    // Rafraîchissement : temps réel (si activé sur les tables), retour sur l'onglet, et toutes les 60 s
    let t: any;
    const soon = () => {
      clearTimeout(t);
      t = setTimeout(() => reload().catch(() => {}), 800);
    };
    const ch = supabase
      .channel('picker-portal')
      .on('postgres_changes', { event: '*', schema: 'public' }, soon)
      .subscribe();
    const onFocus = () => document.visibilityState === 'visible' && soon();
    document.addEventListener('visibilitychange', onFocus);
    const iv = setInterval(soon, 60000);
    return () => {
      supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(iv);
      clearTimeout(t);
    };
  }, [reload]);

  const update = useCallback(
    (fn: (d: DB) => void) => {
      const prev = dbRef.current;
      if (!prev) return;
      const next: DB = JSON.parse(JSON.stringify(prev));
      fn(next);
      commit(next);
      push(prev, next);
    },
    [push],
  );

  const notify = useCallback(
    (userIds: string[], text: string) =>
      update((d) => {
        userIds.forEach((userId) => d.notifications.unshift({ id: uid('n'), userId, text, at: new Date().toISOString(), read: false }));
        d.notifications = d.notifications.slice(0, 300);
      }),
    [update],
  );

  const login = (id: string) => {
    setMeId(id);
    try {
      localStorage.setItem(SESSION, id);
    } catch {}
  };
  const logout = () => {
    setMeId(null);
    try {
      localStorage.removeItem(SESSION);
    } catch {}
  };
  const verifyLogin = (id: string, secret: string) => verifyPin(id, secret);

  /** Réinitialisation : remplace toutes les données Supabase par les données de départ */
  const reset = () => {
    const prev = dbRef.current;
    if (!prev) return;
    const s = createSeed();
    s.punches = prev.punches; // l'historique des pointages est conservé
    commit(s);
    push(prev, s);
    logout();
  };

  const me = useMemo(() => {
    const u = db?.users.find((x) => x.id === meId) || null;
    return u && u.status === 'Actif' ? u : null;
  }, [db, meId]);

  if (!db)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-glovo-bg text-glovo-ink p-6 text-center">
        {loadErr ? (
          <>
            <WifiOff className="w-10 h-10 text-glovo-red" />
            <div className="font-bold">Connexion à la base impossible</div>
            <div className="text-sm text-gray-500 max-w-sm">{loadErr}</div>
            <button
              className="mt-2 px-4 py-2 rounded-xl bg-glovo-yellow font-semibold"
              onClick={() => {
                setLoadErr('');
                reload().catch((e) => setLoadErr(e.message || String(e)));
              }}
            >
              Réessayer
            </button>
          </>
        ) : (
          <>
            <RefreshCw className="w-8 h-8 animate-spin text-glovo-green" />
            <div className="text-sm text-gray-500">Chargement de Picker Portal…</div>
          </>
        )}
      </div>
    );

  return (
    <DBContext.Provider value={{ db, update, me, login, logout, verifyLogin, notify, reset, reload, storageOk: sync !== 'error', sync, syncError }}>
      {children}
    </DBContext.Provider>
  );
}

export const useDB = () => useContext(DBContext);
