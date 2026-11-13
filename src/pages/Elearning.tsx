import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BellRing,
  BookOpen,
  CheckCircle2,
  FileUp,
  GraduationCap,
  ImagePlus,
  Link2,
  Pencil,
  PlayCircle,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Video,
  XCircle,
} from 'lucide-react';
import type { PageProps } from '../App';
import { useDB } from '../lib/store';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Textarea, useConfirm, useUI } from '../components/ui';
import { fmtDate, generateQuiz, isManager, isStaff, lvl, mediaUrl, parseCourseFile, putMedia, uid, youtubeEmbed } from '../lib/utils';
import type { Course, CourseSection } from '../types';

const PASS = 80;

/* ============ Médias ============ */
function useMediaSrc(ref?: string) {
  const [src, setSrc] = useState<string | null>(ref && !ref.startsWith('idb:') ? ref : null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    setErr(false);
    if (!ref) return setSrc(null);
    if (!ref.startsWith('idb:')) return setSrc(ref);
    mediaUrl(ref).then(
      (u) => alive && setSrc(u),
      () => alive && setErr(true),
    );
    return () => {
      alive = false;
    };
  }, [ref]);
  return { src, err };
}

function MediaImg({ refSrc, className = '', onClick }: { refSrc: string; className?: string; onClick?: () => void }) {
  const { src, err } = useMediaSrc(refSrc);
  if (err) return <div className={`bg-gray-100 text-[10px] text-gray-400 flex items-center justify-center ${className}`}>Image indisponible</div>;
  if (!src) return <div className={`bg-gray-100 animate-pulse ${className}`} />;
  return <img src={src} alt="" className={className} onClick={onClick} loading="lazy" />;
}

function MediaVideo({ refSrc }: { refSrc: string }) {
  const yt = youtubeEmbed(refSrc);
  const { src, err } = useMediaSrc(yt ? undefined : refSrc);
  if (yt)
    return (
      <div>
        <div className="aspect-video rounded-xl overflow-hidden bg-black">
          <iframe src={yt} title="Vidéo de formation" className="w-full h-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
        <a href={refSrc} target="_blank" rel="noreferrer" className="text-[11px] text-glovo-green font-semibold mt-1 inline-block">
          La vidéo ne s'affiche pas ? Ouvrir sur YouTube
        </a>
      </div>
    );
  if (/vimeo\.com/.test(refSrc))
    return (
      <a href={refSrc} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-glovo-ink text-white p-4 text-sm font-semibold">
        <PlayCircle className="w-6 h-6 text-glovo-yellow" /> Ouvrir la vidéo
      </a>
    );
  if (err) return <div className="rounded-xl bg-gray-100 p-4 text-sm text-gray-500">Vidéo indisponible sur cet appareil.</div>;
  if (!src) return <div className="aspect-video rounded-xl bg-gray-100 animate-pulse" />;
  return <video src={src} controls playsInline className="w-full rounded-xl bg-black max-h-[420px]" />;
}

export default function Elearning({ scope }: PageProps) {
  const { me: meMaybe } = useDB();
  const me = meMaybe!;
  const admin = isManager(me);
  const lead = lvl(me) === 2;
  const [tab, setTab] = useState<'cours' | 'suivi' | 'gestion'>(admin ? 'gestion' : 'cours');
  const tabs: { id: typeof tab; label: string }[] = admin
    ? [
        { id: 'gestion', label: 'Modules' },
        { id: 'suivi', label: 'Suivi & rappels' },
        { id: 'cours', label: 'Aperçu apprenant' },
      ]
    : lead
      ? [
          { id: 'cours', label: 'Mes formations' },
          { id: 'suivi', label: 'Suivi du store' },
        ]
      : [];

  return (
    <div>
      <PageHeader title="Formations & Quiz Glovo" subtitle={`Certification à partir de ${PASS}% de bonnes réponses`} icon={GraduationCap} />
      {tabs.length > 0 && (
        <div className="inline-flex rounded-xl bg-white border p-1 mb-4">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === t.id ? 'bg-glovo-yellow' : 'text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {tab === 'cours' && <Learner preview={admin} />}
      {tab === 'suivi' && <Tracking scope={scope} canRemind={admin} />}
      {tab === 'gestion' && <Manage />}
    </div>
  );
}

/* ============ Parcours apprenant ============ */
function Learner({ preview }: { preview: boolean }) {
  const { db, me } = useDB();
  const [open, setOpen] = useState<Course | null>(null);
  if (open) return <CoursePlayer course={open} preview={preview} onExit={() => setOpen(null)} />;
  const stats = db.courses.map((c) => {
    const best = db.results.filter((r) => r.userId === me!.id && r.courseId === c.id).reduce((m, r) => Math.max(m, r.score), -1);
    const seen = db.progress[`${me!.id}|${c.id}`] || 0;
    const passed = best >= PASS;
    const pct = passed ? 100 : Math.round((Math.min(seen, c.sections.length) / (c.sections.length + 1)) * 100);
    return { c, best, passed, pct };
  });
  const certified = stats.filter((s) => s.passed).length;

  return (
    <div>
      <Card className="p-4 mb-4 flex items-center gap-4 bg-gradient-to-r from-glovo-yellow/30 to-white">
        <div className="w-14 h-14 rounded-2xl bg-glovo-green text-white flex items-center justify-center shrink-0">
          <Award className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-lg">
            {certified}/{db.courses.length} certification(s)
          </div>
          <div className="h-2 bg-white rounded-full mt-1 overflow-hidden border">
            <div className="h-full bg-glovo-green transition-all" style={{ width: `${db.courses.length ? (certified / db.courses.length) * 100 : 0}%` }} />
          </div>
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(({ c, best, passed, pct }) => {
          const cover = c.sections.find((s) => s.images?.length)?.images?.[0];
          const media = c.sections.reduce((n, s) => n + (s.images?.length || 0) + (s.video ? 1 : 0), 0);
          return (
            <Card key={c.id} className="overflow-hidden flex flex-col group hover:shadow-md transition">
              <div className="relative h-32 bg-gradient-to-br from-glovo-yellow to-amber-300">
                {cover ? (
                  <MediaImg refSrc={cover} className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-16 h-16 text-white/70 absolute right-4 bottom-3" />
                )}
                <div className="absolute top-2 left-2">
                  {passed ? (
                    <span className="inline-flex items-center gap-1 bg-glovo-green text-white text-[11px] font-bold px-2 py-1 rounded-full shadow">
                      <Award className="w-3.5 h-3.5" /> Certifié • {best}%
                    </span>
                  ) : best >= 0 ? (
                    <Badge color="red">À repasser • {best}%</Badge>
                  ) : pct > 0 ? (
                    <Badge color="blue">En cours</Badge>
                  ) : (
                    <Badge color="yellow">Nouveau</Badge>
                  )}
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="font-bold leading-snug">{c.title}</div>
                <p className="text-sm text-gray-500 mt-1 flex-1 line-clamp-2">{c.description}</p>
                <div className="text-[11px] text-gray-400 mt-2 flex flex-wrap gap-x-3">
                  <span>{c.sections.length} chapitres</span>
                  <span>{c.quiz.length} questions</span>
                  {media > 0 && <span>{media} média(s)</span>}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full ${passed ? 'bg-glovo-green' : 'bg-glovo-yellow'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{pct}%</span>
                </div>
                <Button className="mt-3" variant={passed ? 'outline' : 'primary'} icon={passed ? BookOpen : PlayCircle} onClick={() => setOpen(c)}>
                  {passed ? 'Revoir' : best >= 0 ? 'Réessayer' : pct > 0 ? 'Continuer' : 'Commencer'}
                </Button>
              </div>
            </Card>
          );
        })}
        {db.courses.length === 0 && <Empty text="Aucune formation disponible." />}
      </div>
    </div>
  );
}

function CoursePlayer({ course, onExit, preview }: { course: Course; onExit: () => void; preview: boolean }) {
  const { db, me, update } = useDB();
  const n = course.sections.length;
  const pk = `${me!.id}|${course.id}`;
  const [step, setStep] = useState(() => Math.min(db.progress[pk] || 0, n - 1 < 0 ? 0 : n - 1));
  const [answers, setAnswers] = useState<number[]>(Array(course.quiz.length).fill(-1));
  const [score, setScore] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const goto = (s: number) => {
    setStep(s);
    if (!preview && s > (db.progress[pk] || 0))
      update((d) => {
        d.progress[pk] = Math.max(d.progress[pk] || 0, s);
      });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' && step < n) goto(step + 1);
      if (e.key === 'ArrowLeft' && step > 0 && step <= n) goto(step - 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const submit = () => {
    const good = course.quiz.filter((q, i) => answers[i] === q.answer).length;
    const s = course.quiz.length ? Math.round((good / course.quiz.length) * 100) : 100;
    setScore(s);
    if (!preview)
      update((d) => {
        d.results.push({ userId: me!.id, courseId: course.id, score: s, passed: s >= PASS, at: new Date().toISOString() });
        d.progress[pk] = n;
      });
    setStep(n + 1);
  };

  const sec: CourseSection | undefined = course.sections[step];
  const answered = answers.filter((a) => a >= 0).length;

  return (
    <div className="max-w-3xl">
      <button onClick={onExit} className="text-sm text-gray-500 flex items-center gap-1 mb-3">
        <ArrowLeft className="w-4 h-4" /> Retour aux formations
      </button>
      <h2 className="text-xl font-extrabold">{course.title}</h2>
      {preview && <div className="text-xs text-amber-700 mt-1">Mode aperçu : aucun résultat n'est enregistré.</div>}

      {/* Stepper */}
      <div className="flex items-center gap-1 my-4 overflow-x-auto pb-1">
        {course.sections.map((s, i) => (
          <button
            key={i}
            onClick={() => step <= n && goto(i)}
            title={s.title}
            className={`h-2 flex-1 min-w-[18px] rounded-full transition ${i < step || step > n ? 'bg-glovo-green' : i === step ? 'bg-glovo-yellow' : 'bg-gray-200'}`}
          />
        ))}
        <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${step >= n ? 'bg-glovo-yellow' : 'bg-gray-200 text-gray-500'}`}>QUIZ</span>
      </div>

      {step < n && sec && (
        <Card className="overflow-hidden">
          {sec.images && sec.images.length > 0 && (
            <div className="bg-gray-50 border-b">
              <MediaImg refSrc={sec.images[0]} className="w-full max-h-80 object-contain cursor-zoom-in" onClick={() => setZoom(sec.images![0])} />
              {sec.images.length > 1 && (
                <div className="flex gap-2 p-2 overflow-x-auto">
                  {sec.images.slice(1).map((im) => (
                    <MediaImg key={im} refSrc={im} className="h-20 w-28 object-cover rounded-lg border cursor-zoom-in shrink-0" onClick={() => setZoom(im)} />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="p-5">
            <div className="text-xs font-bold text-glovo-green mb-1">
              Chapitre {step + 1}/{n}
            </div>
            <h3 className="font-extrabold text-lg mb-3">{sec.title}</h3>
            {sec.video && (
              <div className="mb-4">
                <MediaVideo refSrc={sec.video} />
              </div>
            )}
            <div className="text-[15px] leading-relaxed text-gray-700 whitespace-pre-line">{sec.content}</div>
            <div className="flex justify-between mt-6">
              <Button variant="outline" icon={ArrowLeft} disabled={step === 0} onClick={() => goto(step - 1)}>
                Précédent
              </Button>
              <Button onClick={() => goto(step + 1)}>
                {step === n - 1 ? 'Passer au quiz' : 'Suivant'} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === n && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">Quiz de validation</span>
            <span className="text-gray-500">
              {answered}/{course.quiz.length} répondu(es)
            </span>
          </div>
          {course.quiz.map((q, i) => (
            <Card key={i} className={`p-4 transition ${answers[i] >= 0 ? 'border-glovo-green/50' : ''}`}>
              <div className="font-semibold text-sm mb-2">
                <span className="inline-flex w-6 h-6 rounded-full bg-glovo-ink text-white text-xs items-center justify-center mr-2">{i + 1}</span>
                {q.q}
              </div>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {q.options.map((o, j) => (
                  <button
                    key={j}
                    onClick={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))}
                    className={`text-left rounded-xl border px-3 py-2 text-sm transition ${answers[i] === j ? 'border-glovo-green bg-emerald-50 ring-1 ring-glovo-green font-semibold' : 'hover:bg-gray-50'}`}
                  >
                    <span className="text-gray-400 mr-1.5">{'ABCD'[j]}.</span>
                    {o}
                  </button>
                ))}
              </div>
            </Card>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" icon={ArrowLeft} onClick={() => goto(n - 1)} disabled={n === 0}>
              Revoir le cours
            </Button>
            <Button variant="green" size="lg" className="flex-1" disabled={answers.some((a) => a < 0)} onClick={submit}>
              Valider mes réponses
            </Button>
          </div>
        </div>
      )}

      {step === n + 1 && score !== null && (
        <Card className="p-6 text-center">
          {score >= PASS ? (
            <div className="rounded-2xl border-4 border-double border-glovo-yellow p-5 bg-gradient-to-b from-glovo-yellow/10 to-white">
              <Award className="w-14 h-14 text-glovo-green mx-auto" />
              <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-2">Certificat de formation</div>
              <div className="text-lg font-extrabold mt-1">{course.title}</div>
              <div className="text-sm mt-1">
                décerné à <b>{me!.name}</b> — {fmtDate(new Date())}
              </div>
              <div className="text-4xl font-extrabold text-glovo-green mt-2">{score}%</div>
            </div>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-glovo-red mx-auto" />
              <div className="text-4xl font-extrabold mt-2">{score}%</div>
              <p className="mt-1 font-semibold">Score insuffisant (minimum {PASS}%).</p>
            </>
          )}
          <div className="text-left mt-4 space-y-1">
            {course.quiz.map((q, i) => (
              <div key={i} className={`text-xs rounded-lg px-3 py-1.5 ${answers[i] === q.answer ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {answers[i] === q.answer ? '✓' : '✗'} {q.q} — <b>{q.options[q.answer]}</b>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-5">
            {score < PASS && (
              <Button
                icon={RotateCcw}
                onClick={() => {
                  setAnswers(Array(course.quiz.length).fill(-1));
                  setScore(null);
                  goto(0);
                }}
              >
                Recommencer
              </Button>
            )}
            <Button variant="outline" onClick={onExit}>
              Terminer
            </Button>
          </div>
        </Card>
      )}

      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Illustration" wide>
        {zoom && <MediaImg refSrc={zoom} className="w-full rounded-xl" />}
      </Modal>
    </div>
  );
}

/* ============ Suivi ============ */
function Tracking({ scope, canRemind }: { scope: PageProps['scope']; canRemind: boolean }) {
  const { db, notify } = useDB();
  const ui = useUI();
  const agents = db.users.filter((u) => isStaff(u) && u.status === 'Actif' && (scope === 'ALL' || u.store === scope));
  const best = (uid: string, cid: string) => db.results.filter((r) => r.userId === uid && r.courseId === cid).reduce((m, r) => Math.max(m, r.score), -1);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {db.courses.map((c) => {
          const missing = agents.filter((a) => best(a.id, c.id) < PASS);
          const pct = agents.length ? Math.round(((agents.length - missing.length) / agents.length) * 100) : 0;
          return (
            <Card key={c.id} className="p-4">
              <div className="font-semibold text-sm">{c.title}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-glovo-green" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-bold">{pct}%</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{missing.length} agent(s) non certifié(s)</div>
              {canRemind && missing.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={BellRing}
                  className="mt-2"
                  onClick={() => {
                    notify(
                      missing.map((m) => m.id),
                      `📚 Rappel : la formation « ${c.title} » est à valider (score ≥ ${PASS}%).`,
                    );
                    ui.toast(`Rappel envoyé à ${missing.length} agent(s)`);
                  }}
                >
                  Envoyer un rappel
                </Button>
              )}
            </Card>
          );
        })}
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Agent</th>
                {db.courses.map((c) => (
                  <th key={c.id} className="px-3 py-3 text-center min-w-[110px]">
                    {c.title.split(':')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs text-gray-400">{a.role}</div>
                  </td>
                  {db.courses.map((c) => {
                    const b = best(a.id, c.id);
                    const seen = db.progress[`${a.id}|${c.id}`] || 0;
                    return (
                      <td key={c.id} className="text-center px-3">
                        {b >= PASS ? (
                          <Badge color="green">
                            <Award className="w-3 h-3" /> {b}%
                          </Badge>
                        ) : b >= 0 ? (
                          <Badge color="red">{b}%</Badge>
                        ) : seen > 0 ? (
                          <Badge color="blue">
                            {seen}/{c.sections.length}
                          </Badge>
                        ) : (
                          <Badge>—</Badge>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ============ Gestion (Store Manager / Super Admin) ============ */
function SectionMedia({ sec, onChange }: { sec: CourseSection; onChange: (s: CourseSection) => void }) {
  const ui = useUI();
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const addFile = async (f: File, kind: 'image' | 'video') => {
    setBusy(true);
    try {
      const ref = await putMedia(f);
      if (kind === 'image') onChange({ ...sec, images: [...(sec.images || []), ref] });
      else onChange({ ...sec, video: ref });
    } catch (e: any) {
      ui.toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };
  const addUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\//.test(u)) return ui.toast('Lien invalide (http/https)', 'err');
    if (youtubeEmbed(u) || /\.(mp4|webm|mov)(\?|$)/i.test(u) || /vimeo\.com/.test(u)) onChange({ ...sec, video: u });
    else onChange({ ...sec, images: [...(sec.images || []), u] });
    setUrl('');
  };

  return (
    <div className="rounded-lg bg-gray-50 p-2 space-y-2">
      {(sec.images?.length || sec.video) && (
        <div className="flex flex-wrap gap-2">
          {sec.images?.map((im) => (
            <div key={im} className="relative">
              <MediaImg refSrc={im} className="w-20 h-14 object-cover rounded-md border" />
              <button
                onClick={() => onChange({ ...sec, images: sec.images!.filter((x) => x !== im) })}
                className="absolute -top-1.5 -right-1.5 bg-glovo-red text-white rounded-full w-5 h-5 text-xs leading-none"
                aria-label="Retirer"
              >
                ×
              </button>
            </div>
          ))}
          {sec.video && (
            <div className="relative flex items-center gap-1 bg-glovo-ink text-white rounded-md px-2 h-14 text-[11px] max-w-[200px]">
              <Video className="w-4 h-4 text-glovo-yellow shrink-0" />
              <span className="truncate">{sec.video.startsWith('idb:') ? 'Vidéo importée' : sec.video}</span>
              <button onClick={() => onChange({ ...sec, video: undefined })} className="absolute -top-1.5 -right-1.5 bg-glovo-red text-white rounded-full w-5 h-5 text-xs leading-none" aria-label="Retirer">
                ×
              </button>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" icon={ImagePlus} disabled={busy} onClick={() => imgRef.current?.click()}>
          Image
        </Button>
        <Button size="sm" variant="outline" icon={Video} disabled={busy} onClick={() => vidRef.current?.click()}>
          Vidéo locale
        </Button>
        <div className="flex gap-1 flex-1 min-w-[200px]">
          <Input className="!py-1 text-xs" placeholder="URL image, YouTube ou MP4" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button size="sm" variant="outline" icon={Link2} onClick={addUrl} disabled={!url} aria-label="Ajouter le lien" />
        </div>
        <input
          ref={imgRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            for (const f of files) await addFile(f, 'image');
          }}
        />
        <input
          ref={vidRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) addFile(f, 'video');
          }}
        />
      </div>
      {busy && <div className="text-[11px] text-gray-500">Enregistrement du média…</div>}
    </div>
  );
}

function Manage() {
  const { db, update } = useDB();
  const ui = useUI();
  const { confirm, node } = useConfirm();
  const [edit, setEdit] = useState<Course | null>(null);
  const [importing, setImporting] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const blank = (): Course => ({
    id: uid('c'),
    title: '',
    description: '',
    sections: [{ title: 'Chapitre 1', content: '', images: [] }],
    quiz: [{ q: '', options: ['', '', '', ''], answer: 0 }],
    createdAt: new Date().toISOString(),
  });

  const onImport = async (f: File) => {
    setImporting('Analyse du fichier…');
    try {
      const { title, sections, images, videos } = await parseCourseFile(f, setImporting);
      const quiz = generateQuiz(sections);
      setEdit({
        id: uid('c'),
        title,
        description: `Module généré automatiquement depuis « ${f.name} ».`,
        sections,
        quiz: quiz.length ? quiz : [{ q: '', options: ['', '', '', ''], answer: 0 }],
        source: f.name,
        createdAt: new Date().toISOString(),
      });
      ui.toast(`${sections.length} chapitres, ${images} image(s), ${videos} vidéo(s) et ${quiz.length} questions extraits — vérifiez avant d'enregistrer`);
    } catch (e: any) {
      ui.toast(e.message, 'err');
    } finally {
      setImporting('');
    }
  };

  const save = () => {
    if (!edit) return;
    if (!edit.title.trim()) return ui.toast('Titre obligatoire', 'err');
    const quiz = edit.quiz.filter((q) => q.q.trim() && q.options.filter((o) => o.trim()).length >= 2);
    update((d) => {
      const c = { ...edit, quiz };
      const i = d.courses.findIndex((x) => x.id === c.id);
      if (i >= 0) d.courses[i] = c;
      else d.courses.push(c);
    });
    ui.toast('Module enregistré');
    setEdit(null);
  };

  const setSec = (i: number, s: CourseSection) => setEdit((e) => (e ? { ...e, sections: e.sections.map((x, k) => (k === i ? s : x)) } : e));

  return (
    <div>
      {node}
      <div className="flex flex-wrap gap-2 mb-2">
        <Button icon={Plus} onClick={() => setEdit(blank())}>
          Nouveau module
        </Button>
        <Button variant="outline" icon={FileUp} disabled={!!importing} onClick={() => fileRef.current?.click()}>
          {importing || 'Importer PowerPoint (.pptx) / Word (.docx)'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".pptx,.docx,.ppt,.doc"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = '';
          }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mb-4">
        L'import extrait le texte de chaque diapositive / paragraphe, les images intégrées (ppt/media, word/media), les vidéos et liens vidéo, puis génère un QCM en français.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {db.courses.map((c) => {
          const cover = c.sections.find((s) => s.images?.length)?.images?.[0];
          const imgs = c.sections.reduce((n, s) => n + (s.images?.length || 0), 0);
          const vids = c.sections.filter((s) => s.video).length;
          return (
            <Card key={c.id} className="overflow-hidden">
              <div className="h-24 bg-gradient-to-br from-glovo-yellow to-amber-300 relative">
                {cover ? <MediaImg refSrc={cover} className="w-full h-full object-cover" /> : <BookOpen className="w-12 h-12 text-white/70 absolute right-3 bottom-2" />}
              </div>
              <div className="p-4">
                <div className="font-bold">{c.title}</div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                <div className="text-xs text-gray-400 mt-2">
                  {c.sections.length} chapitres • {c.quiz.length} questions • {imgs} image(s) • {vids} vidéo(s) • {fmtDate(c.createdAt)}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEdit(JSON.parse(JSON.stringify(c)))}>
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    className="text-glovo-red"
                    onClick={() =>
                      confirm(`Supprimer le module « ${c.title} » et ses résultats ?`, () =>
                        update((d) => {
                          d.courses = d.courses.filter((x) => x.id !== c.id);
                          d.results = d.results.filter((r) => r.courseId !== c.id);
                        }),
                      )
                    }
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.source ? `Import : ${edit.source}` : 'Module de formation'} wide>
        {edit && (
          <div className="space-y-4">
            <Field label="Titre">
              <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-sm">Diapositives / chapitres</div>
                <Button size="sm" variant="ghost" icon={Plus} onClick={() => setEdit({ ...edit, sections: [...edit.sections, { title: `Chapitre ${edit.sections.length + 1}`, content: '', images: [] }] })}>
                  Chapitre
                </Button>
              </div>
              <div className="space-y-2">
                {edit.sections.map((s, i) => (
                  <div key={i} className="rounded-xl border p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                      <Input value={s.title} onChange={(e) => setSec(i, { ...s, title: e.target.value })} />
                      <button className="text-glovo-red p-2" onClick={() => setEdit({ ...edit, sections: edit.sections.filter((_, k) => k !== i) })} aria-label="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <Textarea rows={3} value={s.content} onChange={(e) => setSec(i, { ...s, content: e.target.value })} />
                    <SectionMedia sec={s} onChange={(x) => setSec(i, x)} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-sm">QCM</div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Sparkles}
                    onClick={() => {
                      const q = generateQuiz(edit.sections);
                      if (!q.length) return ui.toast('Pas assez de texte pour générer des questions', 'err');
                      setEdit({ ...edit, quiz: q });
                    }}
                  >
                    Générer
                  </Button>
                  <Button size="sm" variant="ghost" icon={Plus} onClick={() => setEdit({ ...edit, quiz: [...edit.quiz, { q: '', options: ['', '', '', ''], answer: 0 }] })}>
                    Question
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {edit.quiz.map((q, i) => (
                  <div key={i} className="rounded-xl border p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input placeholder={`Question ${i + 1}`} value={q.q} onChange={(e) => setEdit({ ...edit, quiz: edit.quiz.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)) })} />
                      <button className="text-glovo-red p-2" onClick={() => setEdit({ ...edit, quiz: edit.quiz.filter((_, k) => k !== i) })} aria-label="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {q.options.map((o, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={q.answer === j}
                          onChange={() => setEdit({ ...edit, quiz: edit.quiz.map((x, k) => (k === i ? { ...x, answer: j } : x)) })}
                          className="accent-[#00A082]"
                          title="Bonne réponse"
                        />
                        <Input
                          placeholder={`Réponse ${j + 1}`}
                          value={o}
                          onChange={(e) =>
                            setEdit({ ...edit, quiz: edit.quiz.map((x, k) => (k === i ? { ...x, options: x.options.map((y, m) => (m === j ? e.target.value : y)) } : x)) })
                          }
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Cochez la bonne réponse de chaque question. Seuil de certification : {PASS}%.</p>
            </div>
            <div className="flex justify-end gap-2 sticky bottom-0 bg-white pt-2">
              <Button variant="outline" onClick={() => setEdit(null)}>
                Annuler
              </Button>
              <Button variant="green" icon={CheckCircle2} onClick={save}>
                Enregistrer le module
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
