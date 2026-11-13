import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Copy, Info, X, XCircle } from 'lucide-react';
import { isSandboxed, toCSV } from '../lib/utils';

/* ---------------- Logo ---------------- */
export function Logo({ size = 40, withText = true, light = false, badge }: { size?: number; withText?: boolean; light?: boolean; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Logo Picker Portal">
        <rect width="64" height="64" rx="16" fill="#FFC244" />
        {/* Panier de picking */}
        <path d="M14 26h36l-4 20a4 4 0 0 1-4 3H22a4 4 0 0 1-4-3z" fill="#00A082" />
        <path d="M23 26l6-11M41 26l-6-11" stroke="#1F2937" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M24 34v8M32 34v8M40 34v8" stroke="#FFC244" strokeWidth="3" strokeLinecap="round" />
        {/* Pin de géolocalisation */}
        <circle cx="49" cy="15" r="9" fill="#1F2937" />
        <circle cx="49" cy="15" r="3.5" fill="#FFC244" />
      </svg>
      {withText && (
        <div className="leading-none">
          <div className="flex items-center gap-2">
            <div className={`font-extrabold text-lg tracking-tight ${light ? 'text-white' : 'text-glovo-ink'}`}>
              Picker<span className="text-glovo-green">Portal</span>
            </div>
            {badge}
          </div>
          <div className={`text-[10px] font-semibold uppercase tracking-widest ${light ? 'text-white/70' : 'text-gray-500'}`}>Glovo • Abidjan</div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Badge Glovo Express ---------------- */
/** Fallback SVG « Glovo Express » : fond #FFC244, sac + éclair #00A082 */
export function GlovoExpressSvg({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="#FFC244" />
      <path d="M13 18h22l-2 18a3 3 0 0 1-3 2.6H18a3 3 0 0 1-3-2.6z" fill="#00A082" />
      <path d="M19 18v-2a5 5 0 0 1 10 0v2" fill="none" stroke="#00A082" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M25.5 21.5l-5 7h3.6l-1.6 6.5 5.5-8h-3.7z" fill="#FFC244" />
    </svg>
  );
}

/** Badge Glovo Express : image configurable (URL ou Base64) avec repli SVG */
export function GlovoExpressBadge({ src, compact = false }: { src?: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const showImg = !!src && !failed;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-white border border-glovo-yellow/70 shadow-sm pl-0.5 pr-2.5 py-0.5 select-none shrink-0"
      title="Glovo Express"
    >
      {showImg ? (
        <img src={src} alt="Glovo Express" onError={() => setFailed(true)} className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full object-contain`} />
      ) : (
        <GlovoExpressSvg size={compact ? 20 : 24} />
      )}
      <span className={`font-extrabold leading-none tracking-tight ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <span className="text-glovo-green">Glovo</span> <span className="text-glovo-ink">Express</span>
      </span>
    </span>
  );
}

/* ---------------- Primitives ---------------- */
type BtnVariant = 'primary' | 'green' | 'ghost' | 'danger' | 'outline';
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  icon: Icon,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: any }) {
  const v = {
    primary: 'bg-glovo-yellow text-glovo-ink hover:brightness-95',
    green: 'bg-glovo-green text-white hover:brightness-110',
    ghost: 'bg-transparent text-glovo-ink hover:bg-gray-100',
    danger: 'bg-glovo-red text-white hover:brightness-110',
    outline: 'bg-white border border-gray-300 text-glovo-ink hover:bg-gray-50',
  }[variant];
  const s = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3.5 text-base' }[size];
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${v} ${s} ${className}`}
    >
      {Icon && <Icon className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />}
      {children}
    </button>
  );
}

export const Card = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>{children}</div>
);

export function Badge({ color = 'gray', children }: { color?: 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'indigo'; children: React.ReactNode }) {
  const c = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-emerald-100 text-emerald-800',
    yellow: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-sky-100 text-sky-800',
    indigo: 'bg-indigo-100 text-indigo-800',
  }[color];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${c}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, icon: Icon, actions }: { title: string; subtitle?: string; icon?: any; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-11 h-11 rounded-xl bg-glovo-yellow/90 flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-glovo-ink" />
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-glovo-ink">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-glovo-yellow focus:border-glovo-yellow';
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className || ''}`} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={`${inputCls} ${p.className || ''}`} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${inputCls} ${p.className || ''}`} />;
export const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
  </label>
);

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print" onClick={onClose}>
      <div
        className={`bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b z-10">
          <h3 className="font-bold text-glovo-ink">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const Empty = ({ icon: Icon = Info, text }: { icon?: any; text: string }) => (
  <div className="text-center py-10 text-gray-400">
    <Icon className="w-10 h-10 mx-auto mb-2 opacity-60" />
    <p className="text-sm">{text}</p>
  </div>
);

export function Stat({ label, value, icon: Icon, tone = 'yellow', sub }: { label: string; value: React.ReactNode; icon: any; tone?: 'yellow' | 'green' | 'red' | 'gray'; sub?: string }) {
  const t = { yellow: 'bg-glovo-yellow/25 text-amber-800', green: 'bg-glovo-green/15 text-glovo-green', red: 'bg-red-100 text-glovo-red', gray: 'bg-gray-100 text-gray-600' }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${t}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div className="text-2xl font-extrabold text-glovo-ink mt-2">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </Card>
  );
}

/* ---------------- Toasts & exports ---------------- */
interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'err' | 'info';
}
interface UICtx {
  toast: (text: string, tone?: Toast['tone']) => void;
  exportCSV: (filename: string, rows: (string | number)[][]) => void;
  exportXLSX: (filename: string, rows: (string | number)[][], sheet?: string) => Promise<void>;
  printPage: (title?: string) => void;
  copyText: (text: string, okMsg?: string) => void;
}
const UIContext = createContext<UICtx>(null as any);
export const useUI = () => useContext(UIContext);

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [fallback, setFallback] = useState<{ name: string; text: string } | null>(null);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const copyText = useCallback(
    (text: string, okMsg = 'Copié dans le presse-papiers') => {
      navigator.clipboard?.writeText(text).then(
        () => toast(okMsg),
        () => setFallback({ name: 'Copie manuelle', text }),
      ) ?? setFallback({ name: 'Copie manuelle', text });
    },
    [toast],
  );

  const exportCSV = useCallback((filename: string, rows: (string | number)[][]) => {
    const csv = toCSV(rows);
    if (isSandboxed) {
      setFallback({ name: filename, text: csv });
      return;
    }
    download(filename, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    toast(`Fichier ${filename} exporté`);
  }, [toast]);

  const exportXLSX = useCallback(async (filename: string, rows: (string | number)[][], sheet = 'Données') => {
    if (isSandboxed) {
      setFallback({ name: filename.replace(/\.xlsx$/, '.csv'), text: toCSV(rows) });
      return;
    }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 30));
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    download(filename, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    toast(`Fichier ${filename} exporté`);
  }, [toast]);

  const printPage = useCallback((title?: string) => {
    const prev = document.title;
    if (title) document.title = title;
    try {
      window.print();
    } catch {
      /* ignoré */
    }
    if (isSandboxed) toast("L'impression PDF est bloquée dans l'aperçu : ouvrez l'application hébergée pour exporter en PDF.", 'info');
    setTimeout(() => (document.title = prev), 500);
  }, [toast]);

  return (
    <UIContext.Provider value={{ toast, exportCSV, exportXLSX, printPage, copyText }}>
      {children}
      <div className="fixed top-3 inset-x-0 z-[60] flex flex-col items-center gap-2 pointer-events-none no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium max-w-[92vw] ${
              t.tone === 'ok' ? 'bg-glovo-green text-white' : t.tone === 'err' ? 'bg-glovo-red text-white' : 'bg-glovo-ink text-white'
            }`}
          >
            {t.tone === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : t.tone === 'err' ? <XCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
            {t.text}
          </div>
        ))}
      </div>
      <Modal open={!!fallback} onClose={() => setFallback(null)} title={`Export : ${fallback?.name}`} wide>
        <p className="text-sm text-gray-600 mb-3">
          Le téléchargement direct n'est pas disponible ici (aperçu sécurisé). Copiez le contenu ci-dessous et collez-le dans Excel ou un fichier texte.
        </p>
        <Textarea readOnly rows={12} value={fallback?.text || ''} className="font-mono text-xs" />
        <div className="flex justify-end mt-3">
          <Button icon={Copy} onClick={() => fallback && navigator.clipboard?.writeText(fallback.text).then(() => toast('Copié'), () => toast('Sélectionnez le texte et copiez-le manuellement', 'info'))}>
            Copier
          </Button>
        </div>
      </Modal>
    </UIContext.Provider>
  );
}

/** Confirmation intégrée (window.confirm n'est pas fiable partout) */
export function useConfirm() {
  const [state, setState] = useState<{ text: string; onYes: () => void } | null>(null);
  const confirm = (text: string, onYes: () => void) => setState({ text, onYes });
  const node = (
    <Modal open={!!state} onClose={() => setState(null)} title="Confirmation">
      <p className="text-sm text-gray-700 mb-5">{state?.text}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setState(null)}>
          Annuler
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            state?.onYes();
            setState(null);
          }}
        >
          Confirmer
        </Button>
      </div>
    </Modal>
  );
  return { confirm, node };
}
