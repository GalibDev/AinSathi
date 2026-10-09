import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from "react";
import {
  AlertCircle,
  LoaderCircle,
  Search,
  FolderOpen,
  X,
  Check,
} from "lucide-react";
import { useEffect, useRef } from "react";
export function Button({
  children,
  variant = "primary",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "gold" | "ghost" | "danger";
}) {
  return (
    <button {...p} className={`button ${variant} ${p.className ?? ""}`}>
      {children}
    </button>
  );
}
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} />;
}
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} />;
}
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">আপনার ডিজিটাল চেম্বার</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>তথ্য লোড হচ্ছে…</span>
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={21} />
      <div>
        {message}
        {retry && <button onClick={retry}>আবার চেষ্টা করুন</button>}
      </div>
    </div>
  );
}
export function Empty({
  title = "কোনো তথ্য পাওয়া যায়নি",
  description = "নতুন তথ্য যোগ করলে এখানে দেখতে পাবেন।",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FolderOpen size={38} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "নাম বা মামলা নম্বর দিয়ে খুঁজুন…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-box">
      <Search size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-title">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="বন্ধ করুন"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Success({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="success">
      <span>
        <Check size={40} />
      </span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Pagination({
  page,
  onChange,
  hasMore,
}: {
  page: number;
  onChange: (p: number) => void;
  hasMore: boolean;
}) {
  return (
    <div className="pagination">
      <Button
        variant="ghost"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        আগের পাতা
      </Button>
      <span>পাতা {new Intl.NumberFormat("bn-BD").format(page + 1)}</span>
      <Button
        variant="ghost"
        disabled={!hasMore}
        onClick={() => onChange(page + 1)}
      >
        পরের পাতা
      </Button>
    </div>
  );
}
