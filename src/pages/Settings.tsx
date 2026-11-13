import { useRef, useState } from 'react';
import { Crosshair, Database, Download, ExternalLink, ImagePlus, Lock, MapPin, RotateCcw, Save, Settings as Cog, Upload } from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Button, Card, Field, GlovoExpressBadge, Input, PageHeader, useConfirm, useUI } from '../components/ui';
import { GLOVO_EXPRESS_LOGO } from '../data/logo';
import { migrate } from '../data/seed';
import { isSandboxed } from '../lib/utils';
import type { Store } from '../types';

export default function SettingsPage(_: PageProps) {
  const { db, me, update, reset, storageOk } = useDB();
  const ui = useUI();
  const { confirm, node } = useConfirm();
  const [stores, setStores] = useState<Store[]>(db.stores);
  const [pwd, setPwd] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(db.glovoExpressLogoUrl.startsWith('data:') ? '' : db.glovoExpressLogoUrl);
  const setLogo = (v: string) =>
    update((d) => {
      d.glovoExpressLogoUrl = v;
    });

  const setS = (i: number, patch: Partial<Store>) => setStores(stores.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  const here = (i: number) => {
    if (!navigator.geolocation) return ui.toast('Géolocalisation indisponible', 'err');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setS(i, { lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) });
        ui.toast(`Position relevée (±${Math.round(p.coords.accuracy)} m) — pensez à enregistrer`);
      },
      () => ui.toast(isSandboxed ? 'Localisation bloquée dans l’aperçu' : 'Autorisez la localisation', 'err'),
      { enableHighAccuracy: true, timeout: 20000 },
    );
  };

  const backup = () => {
    const json = JSON.stringify(db);
    if (isSandboxed) return ui.copyText(json, 'Sauvegarde copiée dans le presse-papiers');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `picker-portal-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="max-w-3xl space-y-4">
      {node}
      <PageHeader title="Paramètres" subtitle="Stores, sécurité et données" icon={Cog} />

      {!storageOk && <div className="rounded-xl bg-red-50 text-glovo-red text-sm p-3">⚠️ La dernière synchronisation avec Supabase a échoué : vérifiez la connexion et les tables (voir supabase/schema.sql).</div>}

      <Card className="p-4 space-y-3">
        <div className="font-bold flex items-center gap-2">
          <ImagePlus className="w-4 h-4 text-glovo-green" /> Branding — badge Glovo Express
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Aperçu :</span>
          <GlovoExpressBadge src={db.glovoExpressLogoUrl} />
          <GlovoExpressBadge src="" />
          <span className="text-[11px] text-gray-400">(repli SVG si l'image ne charge pas)</span>
        </div>
        <Field label="URL de l'image (glovoExpressLogoUrl)" hint="URL https, ou importez un fichier (converti en Base64).">
          <div className="flex gap-2">
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/glovo-express.png" />
            <Button variant="outline" disabled={!logoUrl.trim()} onClick={() => (setLogo(logoUrl.trim()), ui.toast('Logo mis à jour'))}>
              Appliquer
            </Button>
          </div>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon={Upload} onClick={() => logoRef.current?.click()}>
            Importer une image
          </Button>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => (setLogo(GLOVO_EXPRESS_LOGO), setLogoUrl(''), ui.toast('Logo par défaut restauré'))}>
            Logo par défaut
          </Button>
          <Button size="sm" variant="ghost" onClick={() => (setLogo(''), ui.toast('Repli SVG activé'))}>
            Utiliser le SVG
          </Button>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const img = new Image();
              const fr = new FileReader();
              fr.onload = () => {
                img.onload = () => {
                  const c = document.createElement('canvas');
                  const r = Math.min(1, 160 / Math.max(img.width, img.height));
                  c.width = Math.round(img.width * r);
                  c.height = Math.round(img.height * r);
                  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
                  setLogo(c.toDataURL('image/png'));
                  setLogoUrl('');
                  ui.toast('Logo importé');
                };
                img.src = fr.result as string;
              };
              fr.readAsDataURL(f);
            }}
          />
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="font-bold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-glovo-green" /> Coordonnées GPS des stores (geofencing)
        </div>
        {stores.map((s, i) => (
          <div key={s.id} className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{s.name}</div>
              <a href={s.maps} target="_blank" rel="noreferrer" className="text-xs text-glovo-green font-semibold inline-flex items-center gap-1">
                Google Maps <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Latitude">
                <Input type="number" step="0.000001" value={s.lat} onChange={(e) => setS(i, { lat: Number(e.target.value) })} />
              </Field>
              <Field label="Longitude">
                <Input type="number" step="0.000001" value={s.lng} onChange={(e) => setS(i, { lng: Number(e.target.value) })} />
              </Field>
              <Field label="Rayon (m)">
                <Input type="number" min={20} max={1000} value={s.radius} onChange={(e) => setS(i, { radius: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Lien Google Maps">
              <Input value={s.maps} onChange={(e) => setS(i, { maps: e.target.value })} />
            </Field>
            <Button size="sm" variant="outline" icon={Crosshair} onClick={() => here(i)}>
              Utiliser ma position actuelle (sur place)
            </Button>
          </div>
        ))}
        <Button
          variant="green"
          icon={Save}
          onClick={() => {
            update((d) => {
              d.stores = stores;
            });
            ui.toast('Coordonnées enregistrées');
          }}
        >
          Enregistrer les stores
        </Button>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-bold flex items-center gap-2">
          <Lock className="w-4 h-4 text-glovo-green" /> Sécurité
        </div>
        <Field label={`Nouveau mot de passe pour mon compte (${me?.id})`}>
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="8 caractères minimum" />
        </Field>
        <Button
          variant="outline"
          disabled={pwd.length < 8}
          onClick={() => {
            update((d) => {
              const u = d.users.find((x) => x.id === me?.id);
              if (u) u.pin = pwd;
            });
            setPwd('');
            ui.toast('Mot de passe modifié');
          }}
        >
          Modifier le mot de passe
        </Button>
        <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={db.gpsTestMode}
            onChange={(e) =>
              update((d) => {
                d.gpsTestMode = e.target.checked;
              })
            }
            className="mt-0.5 w-4 h-4 accent-[#00A082]"
          />
          <span>
            <b>Mode test GPS</b> — affiche un bouton « Simuler la position » sur l'écran de pointage (pour les démonstrations). Les pointages simulés sont marqués dans le journal.{' '}
            <b className="text-glovo-red">À désactiver en production.</b>
          </span>
        </label>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-bold flex items-center gap-2">
          <Database className="w-4 h-4 text-glovo-green" /> Données
        </div>
        <p className="text-xs text-gray-500">
          Les données sont partagées en temps réel via Supabase. La sauvegarde JSON permet d'en garder une copie. {db.punches.length} pointage(s), {db.reports.length} rapport(s), {db.requests.length} requête(s).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={Download} onClick={backup}>
            Sauvegarder (JSON)
          </Button>
          <Button variant="outline" icon={Upload} onClick={() => fileRef.current?.click()}>
            Restaurer
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const raw = JSON.parse(await f.text());
                if (![2, 3].includes(raw?.version) || !Array.isArray(raw.users)) throw new Error();
                const data = migrate(raw); // accepte les sauvegardes v2 et v3
                confirm('Envoyer cette sauvegarde dans Supabase ? Elle remplacera les données actuelles (les pointages de la sauvegarde sont ajoutés).', () => {
                  update((d) => {
                    const keep = d.punches;
                    Object.assign(d, data);
                    const ids = new Set(d.punches.map((p) => p.id));
                    d.punches = [...keep.filter((p) => !ids.has(p.id)), ...d.punches];
                  });
                  ui.toast('Sauvegarde restaurée');
                });
              } catch {
                ui.toast('Fichier de sauvegarde invalide', 'err');
              }
            }}
          />
          <Button
            variant="danger"
            icon={RotateCcw}
            onClick={() => confirm("Réinitialiser l'application ? Les agents, plannings, requêtes, explications, rapports et paramètres stockés dans Supabase seront remplacés par les 39 agents de départ avec de nouveaux PIN. L'historique des pointages est conservé.", reset)}
          >
            Réinitialiser
          </Button>
        </div>
      </Card>
    </div>
  );
}
