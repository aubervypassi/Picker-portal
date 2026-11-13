import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useDB } from './lib/store';
import { Badge, GlovoExpressBadge, Logo } from './components/ui';
import { fmtDateTime, lvl } from './lib/utils';
import { LEVELS, type StoreId } from './types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pickers from './pages/Pickers';
import Access from './pages/Access';
import Planning from './pages/Planning';
import Pointage from './pages/Pointage';
import Paie from './pages/Paie';
import Elearning from './pages/Elearning';
import Explications from './pages/Explications';
import Requests from './pages/Requests';
import ShiftReports from './pages/ShiftReports';
import SettingsPage from './pages/Settings';

export type Scope = StoreId | 'ALL';
export interface PageProps {
  scope: Scope;
  go: (id: string) => void;
}

/** min = niveau d'habilitation minimal requis */
const NAV: { id: string; label: string; icon: any; min: number }[] = [
  { id: 'accueil', label: 'Accueil', icon: LayoutDashboard, min: 1 },
  { id: 'pointage', label: 'Pointage', icon: MapPin, min: 1 },
  { id: 'planning', label: 'Planning H24', icon: CalendarDays, min: 1 },
  { id: 'pickers', label: 'Équipes & Pickers', icon: Users, min: 2 },
  { id: 'acces', label: 'Utilisateurs & Accès', icon: KeyRound, min: 3 },
  { id: 'paie', label: 'Paie FCFA', icon: Wallet, min: 1 },
  { id: 'formations', label: 'E-Learning', icon: GraduationCap, min: 1 },
  { id: 'explications', label: 'Explications 48h', icon: AlertTriangle, min: 1 },
  { id: 'requetes', label: 'Requêtes', icon: MessageSquare, min: 1 },
  { id: 'rapports', label: 'Rapports de shift', icon: ClipboardCheck, min: 2 },
  { id: 'parametres', label: 'Paramètres', icon: Settings, min: 4 },
];

export default function App() {
  const { db, me, logout, update, sync, syncError } = useDB();
  const [page, setPage] = useState(() => location.hash.replace('#', '') || 'accueil');
  const [adminScope, setAdminScope] = useState<Scope>('ALL');
  const [drawer, setDrawer] = useState(false);
  const [bell, setBell] = useState(false);

  useEffect(() => {
    const h = () => setPage(location.hash.replace('#', '') || 'accueil');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const go = (id: string) => {
    setPage(id);
    setDrawer(false);
    try {
      history.replaceState(null, '', '#' + id);
    } catch {
      /* ignoré */
    }
    window.scrollTo({ top: 0 });
  };

  const level = lvl(me);
  const nav = useMemo(() => NAV.filter((n) => level >= n.min), [level]);
  const current = nav.find((n) => n.id === page) ? page : 'accueil';

  if (!me) return <Login />;

  const scope: Scope = level >= 4 || me.store === 'ALL' ? adminScope : (me.store as StoreId);
  const badge = <GlovoExpressBadge src={db.glovoExpressLogoUrl} />;
  const myNotifs = db.notifications.filter((n) => n.userId === me.id);
  const unread = myNotifs.filter((n) => !n.read).length;
  const storeName = (s: Scope) => (s === 'ALL' ? 'Tous les stores' : db.stores.find((x) => x.id === s)?.name);

  const props: PageProps = { scope, go };
  const PAGES: Record<string, JSX.Element> = {
    accueil: <Dashboard {...props} />,
    pickers: <Pickers {...props} />,
    acces: <Access {...props} />,
    planning: <Planning {...props} />,
    pointage: <Pointage {...props} />,
    paie: <Paie {...props} />,
    formations: <Elearning {...props} />,
    explications: <Explications {...props} />,
    requetes: <Requests {...props} />,
    rapports: <ShiftReports {...props} />,
    parametres: <SettingsPage {...props} />,
  };

  const bottom = ['accueil', 'pointage', 'planning', level === 1 ? 'requetes' : 'pickers'];

  const NavList = () => (
    <nav className="space-y-1">
      {nav.map((n) => (
        <button
          key={n.id}
          onClick={() => go(n.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
            current === n.id ? 'bg-glovo-yellow text-glovo-ink' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <n.icon className="w-5 h-5" />
          {n.label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-glovo-bg text-glovo-ink">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-white border-r flex-col p-4 no-print">
        <div className="mb-6 px-1">
          <Logo />
        </div>
        <NavList />
        <div className="mt-auto pt-4 border-t">
          <div className="text-sm font-bold truncate">{me.name}</div>
          <div className="text-xs text-gray-500">{me.role}</div>
          <div className="text-[10px] text-glovo-green font-semibold mt-0.5">{LEVELS[level]}</div>
          <button onClick={logout} className="mt-3 flex items-center gap-2 text-sm text-glovo-red font-semibold">
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b lg:ml-64 no-print">
        <div className="flex items-center gap-3 px-4 h-16">
          <button className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100" onClick={() => setDrawer(true)} aria-label="Menu">
            <Menu className="w-6 h-6" />
          </button>
          <div className="lg:hidden min-w-0">
            <Logo size={34} badge={<GlovoExpressBadge src={db.glovoExpressLogoUrl} compact />} />
          </div>
          <div className="hidden lg:flex items-center gap-3">
            <span className="font-extrabold">
              Picker<span className="text-glovo-green">Portal</span>
            </span>
            {badge}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {sync !== 'ok' && (
              <span
                title={syncError || 'Synchronisation en cours'}
                className={`hidden sm:inline-flex text-[11px] font-semibold px-2 py-1 rounded-lg ${sync === 'error' ? 'bg-red-100 text-glovo-red' : 'bg-gray-100 text-gray-500'}`}
              >
                {sync === 'error' ? 'Erreur de synchronisation' : 'Enregistrement…'}
              </span>
            )}
            {sync === 'error' && <span className="sm:hidden w-2.5 h-2.5 rounded-full bg-glovo-red" title={syncError} />}
            {level >= 4 || me.store === 'ALL' ? (
              <select
                value={adminScope}
                onChange={(e) => setAdminScope(e.target.value as Scope)}
                className="text-xs sm:text-sm font-semibold rounded-xl border-gray-300 border bg-glovo-bg px-2 py-1.5"
              >
                <option value="ALL">Tous les stores</option>
                {db.stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="hidden sm:inline-flex">
                <Badge color="green">{storeName(scope)}</Badge>
              </span>
            )}
            <div className="relative">
              <button
                onClick={() => {
                  setBell(!bell);
                  if (!bell && unread)
                    setTimeout(
                      () =>
                        update((d) =>
                          d.notifications.forEach((n) => {
                            if (n.userId === me.id) n.read = true;
                          }),
                        ),
                      1500,
                    );
                }}
                className="relative p-2 rounded-xl hover:bg-gray-100"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-glovo-red text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unread}
                  </span>
                )}
              </button>
              {bell && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-xl border z-40 max-h-96 overflow-y-auto">
                  <div className="px-4 py-3 border-b font-bold text-sm">Notifications</div>
                  {myNotifs.length === 0 && <div className="p-4 text-sm text-gray-400">Aucune notification.</div>}
                  {myNotifs.slice(0, 30).map((n) => (
                    <div key={n.id} className={`px-4 py-3 border-b last:border-0 text-sm ${n.read ? '' : 'bg-glovo-yellow/10'}`}>
                      <div>{n.text}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{fmtDateTime(n.at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Drawer mobile */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden no-print" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-y-0 left-0 w-72 bg-white p-4 flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <Logo />
                <div className="mt-2">{badge}</div>
              </div>
              <button onClick={() => setDrawer(false)} aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 p-3 rounded-xl bg-glovo-bg">
              <div className="text-sm font-bold">{me.name}</div>
              <div className="text-xs text-gray-500">
                {me.role} {me.store !== 'ALL' && `• ID ${me.id}`}
              </div>
              <div className="text-[10px] text-glovo-green font-semibold">{LEVELS[level]}</div>
              {me.store !== 'ALL' && <div className="text-[10px] text-gray-500">{storeName(me.store as StoreId)}</div>}
            </div>
            <NavList />
            <button onClick={logout} className="mt-6 flex items-center gap-2 text-sm text-glovo-red font-semibold px-3">
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          </div>
        </div>
      )}

      <main className="lg:ml-64 px-4 sm:px-6 py-5 pb-28 lg:pb-10 max-w-7xl" onClick={() => bell && setBell(false)}>
        {PAGES[current]}
      </main>

      {/* Barre inférieure mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t z-30 grid grid-cols-5 no-print pb-[env(safe-area-inset-bottom)]">
        {bottom.map((id) => {
          const n = NAV.find((x) => x.id === id)!;
          return (
            <button key={id} onClick={() => go(id)} className={`flex flex-col items-center py-2 text-[10px] font-semibold ${current === id ? 'text-glovo-green' : 'text-gray-500'}`}>
              <n.icon className="w-5 h-5 mb-0.5" />
              {n.label.split(' ')[0]}
            </button>
          );
        })}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center py-2 text-[10px] font-semibold text-gray-500">
          <Menu className="w-5 h-5 mb-0.5" />
          Plus
        </button>
      </nav>
    </div>
  );
}
