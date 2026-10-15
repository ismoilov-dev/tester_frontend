/**
 * Lumen dizayn tizimi komponentlari: monoxrom, pill tugmalar, soyasiz chegarali kartalar.
 * Har ekranda bitta `primary` tugma — qolganlari `secondary` yoki `ghost`.
 */
import {
  forwardRef, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes,
} from "react";
import { NavLink } from "react-router-dom";

// ---------------- Button ----------------
type Variant = "primary" | "secondary" | "ghost" | "gradient" | "danger" | "success";
type Size = "sm" | "md" | "lg";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border-border-strong bg-bg text-ink shadow-sm hover:bg-surface-100",
  ghost: "bg-transparent text-ink hover:bg-surface-200",
  gradient: "gradient-aurora text-ink hover:shadow-md",
  danger: "bg-danger text-white hover:opacity-90",
  success: "bg-primary text-on-primary hover:bg-primary-hover", // Lumen: urg'u rang emas, kontrast
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-[18px] text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function Button({ variant = "primary", size = "md", loading, className = "", children, disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

// ---------------- Feedback ----------------
export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

export function FullPageSpinner({ text }: { text?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink-muted">
      <Spinner className="h-7 w-7 text-ink" />
      {text && <p>{text}</p>}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-md border border-border bg-blush/40 px-4 py-3 text-sm text-danger">{children}</div>;
}

/** Bo'sh holat: nima uchun bo'sh va nima qilish kerakligini aytadi. */
export function EmptyState({ title, text, action }: { title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong px-6 py-14 text-center">
      <div className="gradient-aurora mx-auto mb-4 h-12 w-12 rounded-full" />
      <p className="text-lg font-semibold tracking-tight">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-ink-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------- Card ----------------
type Glow = "aurora" | "sunset" | "lagoon";
export function Card({ className = "", title, description, glow, interactive, children }:
  { className?: string; title?: ReactNode; description?: ReactNode; glow?: Glow; interactive?: boolean; children?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-bg p-6 transition ${interactive ? "cursor-pointer hover:border-border-strong hover:shadow-md" : ""} ${className}`}>
      {glow && <div className={`gradient-${glow} -mx-4 -mt-4 mb-5 h-24 rounded-lg`} />}
      {title && <h3 className="text-lg font-semibold tracking-tight">{title}</h3>}
      {description && <p className="mt-1 text-ink-muted">{description}</p>}
      {children && (title || description) ? <div className="mt-4">{children}</div> : children}
    </div>
  );
}

/** Raqamli ko'rsatkich: katta raqam + yorliq. */
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "danger" | "success" | "warning" }) {
  const color = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-ink";
  return (
    <div className="rounded-lg border border-border bg-bg px-5 py-4">
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p className={`mt-1 text-[28px] font-semibold leading-[34px] tracking-tight tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[13px] text-ink-subtle">{hint}</p>}
    </div>
  );
}

// ---------------- Badge ----------------
export type Tone = "neutral" | "peach" | "blush" | "lilac" | "sky" | "mint" | "gradient" | "success" | "danger" | "warning";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-200 text-ink",
  peach: "bg-peach text-ink",
  blush: "bg-blush text-ink",
  lilac: "bg-lilac text-ink",
  sky: "bg-sky text-ink",
  mint: "bg-mint text-ink",
  gradient: "gradient-aurora text-ink",
  success: "border border-border text-success",
  danger: "border border-border text-danger",
  warning: "border border-border text-warning",
};

export function Badge({ tone = "neutral", dot, className = "", children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ---------------- Form ----------------
export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-ink">
      {children}
      {hint && <span className="ml-1 font-normal text-ink-subtle">{hint}</span>}
    </span>
  );
}

export function Hint({ children, error }: { children: ReactNode; error?: boolean }) {
  if (!children) return null;
  return <p className={`mt-1.5 text-[13px] ${error ? "text-danger" : "text-ink-muted"}`}>{children}</p>;
}

const fieldCls = "w-full rounded-md border border-border-strong bg-bg px-3.5 text-[15px] text-ink transition placeholder:text-ink-subtle hover:border-ink-subtle focus:border-ink focus:shadow-[0_0_0_3px_var(--focus)] focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-ink-muted aria-[invalid=true]:border-danger";

// forwardRef — react-hook-form `register` ref orqali qiymatni o'qiydi
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...rest }, ref) {
  return <input ref={ref} {...rest} className={`h-11 ${fieldCls} ${className}`} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = "", ...rest }, ref) {
  return <textarea ref={ref} {...rest} className={`py-2.5 ${fieldCls} ${className}`} />;
});

export function Toggle({ checked, onChange, label, description, disabled }:
  { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-4 py-2.5 ${disabled ? "opacity-45" : "cursor-pointer"}`}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-[13px] text-ink-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-primary" : "bg-border-strong"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg shadow-sm transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

/** Pill ko'rinishidagi segment tanlash (tablar, filtrlar, rejimlar). */
export function Segmented<T extends string>({ value, onChange, options, disabled }:
  { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; disabled?: boolean }) {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-100 p-1">
      {options.map(o => (
        <button key={o.value} type="button" disabled={disabled} onClick={() => onChange(o.value)}
          className={`h-8 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition disabled:opacity-45 ${value === o.value ? "bg-bg text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------- Navigation ----------------
/** Sahifa ichidagi tablar (router linklari). */
export function TabNav({ tabs }: { tabs: { to: string; label: ReactNode; end?: boolean; badge?: ReactNode }[] }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map(t => (
        <NavLink key={t.to} to={t.to} end={t.end}
          className={({ isActive }) => `-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${isActive ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
          {t.label}{t.badge}
        </NavLink>
      ))}
    </nav>
  );
}

/** "⋯" menyusi — ikkinchi darajali amallar uchun. */
export function Menu({ items }: { items: { label: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const visible = items.filter(i => !i.hidden);
  if (!visible.length) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Boshqa amallar" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-200 hover:text-ink">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 min-w-44 rounded-md border border-border bg-bg p-1 shadow-md">
          {visible.map((i, k) => (
            <button key={k} type="button" onClick={e => { e.stopPropagation(); setOpen(false); i.onClick(); }}
              className={`block w-full rounded-sm px-3 py-2 text-left text-sm transition hover:bg-surface-100 ${i.danger ? "text-danger" : "text-ink"}`}>
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Modal ----------------
export function Modal({ open, onClose, title, children, footer, wide }:
  { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onMouseDown={onClose}>
      <div
        className={`max-h-[90vh] w-full overflow-auto rounded-xl border border-border bg-bg shadow-lg ${wide ? "max-w-3xl" : "max-w-md"}`}
        onMouseDown={e => e.stopPropagation()}
      >
        {title && <div className="px-6 pt-6 text-lg font-semibold tracking-tight">{title}</div>}
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 pb-6">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, text, confirmText = "Tasdiqlash", danger, loading }:
  { open: boolean; onClose: () => void; onConfirm: () => void; title: string; text?: ReactNode; confirmText?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Bekor qilish</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmText}</Button>
      </>}>
      {text && <div className="text-ink-muted">{text}</div>}
    </Modal>
  );
}
