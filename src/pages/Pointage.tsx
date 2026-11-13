import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Crosshair, Download, ExternalLink, Lock, LogIn, LogOut, MapPin, RefreshCw, Search, XCircle } from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Select, useUI } from '../components/ui';
import { uploadPhoto } from '../lib/supabase';
import { compressImage, fmtDate, fmtDateTime, fmtTime, haversine, isManager, isSandboxed, lvl, uid, ymd } from '../lib/utils';
import type { Punch, StoreId } from '../types';

interface Pos {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
  simulated?: boolean;
}

export default function Pointage({ scope }: PageProps) {
  const { me: meMaybe } = useDB();
  const me = meMaybe!;
  const admin = isManager(me);
  const manager = lvl(me) >= 2;
  const [tab, setTab] = useState<'pointer' | 'journal'>(admin ? 'journal' : 'pointer');

  return (
    <div>
      <PageHeader title="Pointage" subtitle="Photo obligatoire + géolocalisation ≤ 100 m du store" icon={MapPin} />
      {manager && !admin && (
        <div className="inline-flex rounded-xl bg-white border p-1 mb-4">
          {(['pointer', 'journal'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === t ? 'bg-glovo-yellow' : 'text-gray-500'}`}>
              {t === 'pointer' ? 'Mon pointage' : 'Journal de contrôle'}
            </button>
          ))}
        </div>
      )}
      {tab === 'pointer' && !admin ? <Clock /> : <Journal scope={scope} />}
    </div>
  );
}

/* ================= Écran de pointage ================= */
function Clock() {
  const { db, me, update } = useDB();
  const ui = useUI();
  const store = db.stores.find((s) => s.id === me!.store)!;
  const [pos, setPos] = useState<Pos | null>(null);
  const [gpsErr, setGpsErr] = useState('');
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState<{ data: string; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const watchRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startGps = () => {
    setGpsErr('');
    if (!('geolocation' in navigator)) return setGpsErr("La géolocalisation n'est pas disponible sur cet appareil.");
    setLocating(true);
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setLocating(false);
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy), at: Date.now() });
      },
      (e) => {
        setLocating(false);
        setGpsErr(
          e.code === 1
            ? isSandboxed
              ? "La localisation est bloquée dans l'aperçu. Ouvrez l'application hébergée (HTTPS) sur votre téléphone."
              : 'Autorisez la localisation pour Picker Portal dans les réglages du navigateur.'
            : e.code === 3
              ? 'Délai dépassé. Placez-vous près d’une fenêtre et réessayez.'
              : 'Position indisponible. Activez le GPS et réessayez.',
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  };

  useEffect(() => {
    startGps();
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const distance = pos ? Math.round(haversine(pos.lat, pos.lng, store.lat, store.lng)) : null;
  const inside = distance != null && distance <= store.radius;
  const myPunches = db.punches.filter((p) => p.userId === me!.id);
  const last = myPunches.at(-1);
  const onSite = last?.type === 'ENTRÉE';
  const photoFresh = !!photo && Date.now() - photo.at < 10 * 60 * 1000;
  const ready = photoFresh && inside;

  const onPhoto = async (f: File) => {
    // La photo doit être prise sur place : on refuse les images anciennes de la galerie
    if (Date.now() - f.lastModified > 10 * 60 * 1000) {
      ui.toast('Photo refusée : elle doit être prise maintenant, sur place au store.', 'err');
      return;
    }
    try {
      setBusy(true);
      setPhoto({ data: await compressImage(f), at: Date.now() });
    } catch (e: any) {
      ui.toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const punch = async (type: Punch['type']) => {
    if (!ready || !pos || distance == null || busy) return;
    const id = uid('p');
    const now = new Date();
    let photoUrl = '';
    setBusy(true);
    try {
      // Photo envoyée dans le bucket Supabase « pointages-photos »
      photoUrl = await uploadPhoto(photo!.data, `${me!.store}/${ymd(now)}/${me!.id}_${type === 'ENTRÉE' ? 'entree' : 'sortie'}_${id}.jpg`);
    } catch (e: any) {
      ui.toast('Envoi de la photo impossible : ' + e.message, 'err');
      setBusy(false);
      return;
    }
    setBusy(false);
    const p: Punch = {
      id,
      userId: me!.id,
      store: me!.store as StoreId,
      type,
      at: now.toISOString(),
      lat: pos.lat,
      lng: pos.lng,
      distance,
      accuracy: pos.accuracy,
      photo: photoUrl,
      simulated: pos.simulated,
    };
    update((d) => {
      d.punches.push(p);
    });
    setPhoto(null);
    ui.toast(`${type === 'ENTRÉE' ? 'Entrée' : 'Sortie'} enregistrée à ${fmtTime(p.at)} (${distance} m du store)`);
  };

  const lockReason = !photoFresh
    ? photo
      ? 'Photo expirée : reprenez une photo.'
      : 'Prenez une photo au store pour déverrouiller.'
    : !pos
      ? 'Position GPS en attente…'
      : !inside
        ? `Vous êtes à ${distance} m du store (max ${store.radius} m).`
        : '';

  return (
    <div className="max-w-xl space-y-4">
      {/* Statut */}
      <Card className={`p-4 flex items-center gap-3 ${onSite ? 'border-glovo-green' : ''}`}>
        <div className={`w-3 h-3 rounded-full ${onSite ? 'bg-glovo-green animate-pulse' : 'bg-gray-300'}`} />
        <div className="text-sm">
          {onSite ? (
            <>
              <b className="text-glovo-green">Sur site</b> depuis {fmtTime(last!.at)}
            </>
          ) : last ? (
            <>
              Dernière sortie : <b>{fmtDateTime(last.at)}</b>
            </>
          ) : (
            'Aucun pointage enregistré'
          )}
        </div>
      </Card>

      {/* Étape 1 : GPS */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-bold flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-glovo-ink text-white text-xs flex items-center justify-center">1</span> Position au store
          </div>
          <a href={store.maps} target="_blank" rel="noreferrer" className="text-xs text-glovo-green font-semibold inline-flex items-center gap-1">
            {store.name} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {gpsErr ? (
          <div className="text-sm text-glovo-red bg-red-50 rounded-xl p-3">{gpsErr}</div>
        ) : distance == null ? (
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Localisation en cours…
          </div>
        ) : (
          <div className={`rounded-xl p-3 ${inside ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <div className="flex items-center gap-2">
              {inside ? <CheckCircle2 className="w-5 h-5 text-glovo-green" /> : <XCircle className="w-5 h-5 text-glovo-red" />}
              <span className={`text-2xl font-extrabold ${inside ? 'text-glovo-green' : 'text-glovo-red'}`}>{distance} m</span>
              <span className="text-sm text-gray-600">du store (rayon {store.radius} m)</span>
            </div>
            <div className="h-2 bg-white rounded-full mt-2 overflow-hidden">
              <div className={`h-full ${inside ? 'bg-glovo-green' : 'bg-glovo-red'}`} style={{ width: `${Math.max(4, Math.min(100, 100 - (distance / (store.radius * 3)) * 100))}%` }} />
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Précision ±{pos!.accuracy} m {pos!.simulated && '• position simulée (mode test)'}
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" icon={Crosshair} onClick={startGps} disabled={locating}>
            Actualiser
          </Button>
          {db.gpsTestMode && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setGpsErr('');
                setPos({ lat: store.lat + 0.0002, lng: store.lng + 0.0002, accuracy: 10, at: Date.now(), simulated: true });
              }}
            >
              Simuler la position (mode test)
            </Button>
          )}
        </div>
      </Card>

      {/* Étape 2 : Photo */}
      <Card className="p-4">
        <div className="font-bold flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-glovo-ink text-white text-xs flex items-center justify-center">2</span> Photo obligatoire au store
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPhoto(f);
            e.target.value = '';
          }}
        />
        {photo ? (
          <div className="relative">
            <img src={photo.data} alt="Preuve de présence" className="w-full max-h-72 object-cover rounded-xl" />
            <Button size="sm" variant="outline" icon={Camera} className="absolute bottom-2 right-2" onClick={() => fileRef.current?.click()}>
              Reprendre
            </Button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-500 hover:border-glovo-yellow hover:bg-glovo-yellow/5"
          >
            <Camera className="w-10 h-10" />
            <span className="font-semibold text-sm">{busy ? 'Traitement…' : 'Prendre une photo au store'}</span>
            <span className="text-[11px]">Façade, zone de picking ou badge — la photo est horodatée</span>
          </button>
        )}
      </Card>

      {/* Étape 3 : Boutons */}
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" variant="green" icon={ready && !onSite ? LogIn : Lock} disabled={!ready || onSite || busy} onClick={() => punch('ENTRÉE')} className="py-5">
          Pointer l'Entrée
        </Button>
        <Button size="lg" variant="danger" icon={ready && onSite ? LogOut : Lock} disabled={!ready || !onSite || busy} onClick={() => punch('SORTIE')} className="py-5">
          Pointer la Sortie
        </Button>
      </div>
      {lockReason && (
        <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" /> {lockReason}
        </p>
      )}

      <Card className="p-4">
        <div className="font-bold mb-2 text-sm">Mes derniers pointages</div>
        {myPunches.length === 0 && <div className="text-sm text-gray-400">Aucun pointage.</div>}
        {myPunches
          .slice(-6)
          .reverse()
          .map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-t first:border-0">
              <Badge color={p.type === 'ENTRÉE' ? 'green' : 'red'}>{p.type}</Badge>
              <span>{fmtDateTime(p.at)}</span>
              <span className="text-gray-500">{p.distance} m</span>
            </div>
          ))}
      </Card>
    </div>
  );
}

/* ================= Journal de contrôle ================= */
function Journal({ scope }: { scope: PageProps['scope'] }) {
  const { db } = useDB();
  const ui = useUI();
  const [date, setDate] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState<'ALL' | Punch['type']>('ALL');
  const [zoom, setZoom] = useState<Punch | null>(null);
  const userOf = (id: string) => db.users.find((u) => u.id === id);

  const list = db.punches
    .filter((p) => scope === 'ALL' || p.store === scope)
    .filter((p) => !date || ymd(new Date(p.at)) === date)
    .filter((p) => type === 'ALL' || p.type === type)
    .filter((p) => {
      const u = userOf(p.userId);
      return !q || ((u?.name || '') + p.userId).toLowerCase().includes(q.toLowerCase());
    })
    .slice()
    .reverse();

  const storeName = (s: string) => db.stores.find((x) => x.id === s)?.name || s;

  return (
    <div>
      <Card className="p-3 mb-4 grid sm:grid-cols-4 gap-2">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Agent ou ID…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="ALL">Entrées & sorties</option>
          <option value="ENTRÉE">Entrées</option>
          <option value="SORTIE">Sorties</option>
        </Select>
      </Card>
      <div className="flex justify-end mb-2">
        <Button
          size="sm"
          variant="outline"
          icon={Download}
          onClick={() =>
            ui.exportCSV('journal_pointage.csv', [
              ['Date', 'Heure', 'Store', 'ID', 'Agent', 'Type', 'Distance (m)', 'Précision (m)', 'Latitude', 'Longitude', 'Simulé'],
              ...list.map((p) => [fmtDate(p.at), fmtTime(p.at), storeName(p.store), p.userId, userOf(p.userId)?.name || '', p.type, p.distance, p.accuracy, p.lat, p.lng, p.simulated ? 'Oui' : 'Non']),
            ])
          }
        >
          Exporter CSV
        </Button>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Photo</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Horodatage</th>
                <th className="px-4 py-3">Distance GPS</th>
                <th className="px-4 py-3">Store</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2">
                    {p.photo ? (
                      <button onClick={() => setZoom(p)}>
                        <img src={p.photo} alt="" className="w-12 h-12 object-cover rounded-lg border hover:ring-2 hover:ring-glovo-yellow" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400">archivée</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-semibold">{userOf(p.userId)?.name || 'Agent retiré'}</div>
                    <div className="text-xs text-gray-400">ID {p.userId}</div>
                  </td>
                  <td className="px-4 py-2">
                    <Badge color={p.type === 'ENTRÉE' ? 'green' : 'red'}>{p.type}</Badge>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {fmtDate(p.at)} <b>{fmtTime(p.at)}</b>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <b className={p.distance <= 100 ? 'text-glovo-green' : 'text-glovo-red'}>{p.distance} m</b>
                    <span className="text-xs text-gray-400"> ±{p.accuracy} m</span>
                    {p.simulated && (
                      <div>
                        <Badge color="yellow">simulé</Badge>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{storeName(p.store)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <Empty icon={MapPin} text="Aucun pointage pour ces critères." />}
      </Card>

      <Modal open={!!zoom} onClose={() => setZoom(null)} title={zoom ? `${userOf(zoom.userId)?.name} — ${zoom.type}` : ''}>
        {zoom && (
          <div>
            <img src={zoom.photo} alt="" className="w-full rounded-xl" />
            <div className="text-sm mt-3 space-y-1">
              <div>Horodatage : {fmtDateTime(zoom.at)}</div>
              <div>
                Distance : <b>{zoom.distance} m</b> (précision ±{zoom.accuracy} m)
              </div>
              <a className="text-glovo-green font-semibold inline-flex items-center gap-1" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${zoom.lat},${zoom.lng}`}>
                Voir la position sur Google Maps <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
