import { useState } from 'react';
import { Eye, EyeOff, LogIn, ShieldCheck, UserCog, User as UserIcon, Zap } from 'lucide-react';
import { useDB } from '../lib/store';
import { Button, Field, GlovoExpressBadge, Input, Logo } from '../components/ui';
import { lvl } from '../lib/utils';

export default function Login() {
  const { db, login, verifyLogin } = useDB();
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState('');
  const [secret, setSecret] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [demo, setDemo] = useState(false);

  const target = db.users.find((x) => x.id.toLowerCase() === id.trim().toLowerCase());
  // Niveaux 3-4 (Store Manager / Super Admin) : mot de passe ; niveaux 1-2 : PIN 4 chiffres
  const isAdminId = target ? lvl(target) >= 3 : id.trim().toLowerCase() === 'admin';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const u = db.users.find((x) => x.id.toLowerCase() === id.trim().toLowerCase());
    if (!u) return setErr('Identifiant inconnu. Vérifiez votre ID Glovo.');
    if (u.status === 'Suspendu') return setErr("Votre accès est suspendu. Contactez votre Store Manager.");
    setBusy(true);
    try {
      // vérification côté serveur (le PIN n'est jamais téléchargé sur l'appareil)
      if (!(await verifyLogin(u.id, secret))) return setErr(lvl(u) >= 3 ? 'Mot de passe incorrect.' : 'Code PIN incorrect.');
      login(u.id);
    } catch (e: any) {
      setErr('Serveur injoignable : ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const quick = (uid: string) => {
    const u = db.users.find((x) => x.id === uid);
    if (u && u.status === 'Actif') login(uid);
    else setErr('Compte de démonstration suspendu ou retiré.');
  };

  return (
    <div className="min-h-screen bg-glovo-bg flex flex-col">
      <div className="bg-glovo-yellow h-56 sm:h-64 rounded-b-[40px] flex items-center justify-center relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/20" />
        <div className="absolute -left-12 bottom-0 w-40 h-40 rounded-full bg-glovo-green/20" />
        <div className="text-center relative">
          <div className="flex justify-center">
            <Logo size={64} withText={false} />
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-glovo-ink">
            Picker<span className="text-glovo-green">Portal</span>
          </h1>
          <div className="flex justify-center mt-2">
            <GlovoExpressBadge src={db.glovoExpressLogoUrl} />
          </div>
          <p className="text-sm font-medium text-glovo-ink/70 mt-2">Gestion opérationnelle des pickers • Abidjan</p>
        </div>
      </div>

      <div className="flex-1 px-4 -mt-10">
        <form onSubmit={submit} className="max-w-sm mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 p-6 space-y-4">
          <div className="flex items-center gap-2 text-glovo-ink">
            <ShieldCheck className="w-5 h-5 text-glovo-green" />
            <h2 className="font-bold">Connexion sécurisée</h2>
          </div>
          <Field label="ID Glovo (ou identifiant Admin)">
            <Input inputMode={isAdminId ? 'text' : 'numeric'} autoComplete="username" placeholder="ex. 105607" value={id} onChange={(e) => setId(e.target.value)} autoFocus />
          </Field>
          <Field label={isAdminId ? 'Mot de passe (Store Manager / Super Admin)' : 'Code PIN personnel (4 chiffres)'}>
            <div className="relative">
              <Input
                type={show ? 'text' : 'password'}
                inputMode={isAdminId ? 'text' : 'numeric'}
                maxLength={isAdminId ? 64 : 4}
                autoComplete="current-password"
                placeholder={isAdminId ? '••••••••' : '••••'}
                value={secret}
                onChange={(e) => setSecret(isAdminId ? e.target.value : e.target.value.replace(/\D/g, ''))}
                className={isAdminId ? '' : 'tracking-[0.6em] text-center text-lg font-bold'}
              />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label="Afficher">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          {err && <div className="text-sm text-glovo-red bg-red-50 rounded-xl px-3 py-2">{err}</div>}
          <Button type="submit" variant="green" size="lg" className="w-full" icon={LogIn} disabled={!id || !secret || busy}>
            Se connecter
          </Button>
          <p className="text-[11px] text-gray-400 text-center">Votre code PIN vous est remis par votre Store Manager. Ne le partagez jamais.</p>
        </form>

        <div className="max-w-sm mx-auto mt-6 mb-10 text-center">
          <button onClick={() => setDemo(!demo)} className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
            <Zap className="w-3 h-3" /> Connexion rapide démo
          </button>
          {demo && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => quick('admin')} className="rounded-xl border bg-white p-2 text-xs hover:border-glovo-green">
                <ShieldCheck className="w-4 h-4 mx-auto text-glovo-green" />
                <div className="font-semibold mt-1">Super Admin</div>
                <div className="text-gray-400">Niveau 4</div>
              </button>
              <button onClick={() => quick('136346')} className="rounded-xl border bg-white p-2 text-xs hover:border-glovo-green">
                <UserCog className="w-4 h-4 mx-auto text-amber-600" />
                <div className="font-semibold mt-1">Picker Lead</div>
                <div className="text-gray-400">Malick Gbane</div>
              </button>
              <button onClick={() => quick('105607')} className="rounded-xl border bg-white p-2 text-xs hover:border-glovo-green">
                <UserIcon className="w-4 h-4 mx-auto text-sky-600" />
                <div className="font-semibold mt-1">Picker</div>
                <div className="text-gray-400">Ghislain Blede</div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
