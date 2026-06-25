import React, { useEffect } from 'react';
import { create } from 'zustand';
import styles from '../../styles/components/Toast.module.css';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  nextId: number;
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: number) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  nextId: 0,
  addToast: (message, type) =>
    set((state) => ({
      toasts: [...state.toasts, { id: state.nextId, message, type }],
      nextId: state.nextId + 1,
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  return { toast: addToast };
}

const ToastItem: React.FC<{ item: ToastItem; onDismiss: (id: number) => void }> = ({
  item,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 3000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div className={`${styles.toast} ${styles[`toast_${item.type}`]}`}>
      <span className={styles.message}>{item.message}</span>
      <button className={styles.close} onClick={() => onDismiss(item.id)}>
        ×
      </button>
    </div>
  );
};

export const Toast: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onDismiss={removeToast} />
      ))}
    </div>
  );
};

export default Toast;
