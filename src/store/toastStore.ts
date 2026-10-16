import { create } from 'zustand';
import { triggerHaptic } from '../lib/haptics';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  action?: ToastAction;
  createdAt: number;
}

export type ToastInput = Omit<ToastItem, 'id' | 'createdAt'>;

interface ToastState {
  toasts: ToastItem[];
  show: (input: ToastInput) => string;
  success: (message: string, title?: string, options?: Partial<ToastInput>) => string;
  error: (message: string, title?: string, options?: Partial<ToastInput>) => string;
  warning: (message: string, title?: string, options?: Partial<ToastInput>) => string;
  info: (message: string, title?: string, options?: Partial<ToastInput>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const DEFAULT_DURATION = 3500;
const MAX_CONCURRENT_TOASTS = 2;

let counter = 0;
function generateToastId(): string {
  counter += 1;
  return `toast-${Date.now()}-${counter}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (input) => {
    const id = generateToastId();
    const duration = input.duration ?? DEFAULT_DURATION;
    const newToast: ToastItem = {
      ...input,
      id,
      duration,
      createdAt: Date.now(),
    };

    switch (input.type) {
      case 'success':
        triggerHaptic('notificationSuccess');
        break;
      case 'error':
        triggerHaptic('notificationError');
        break;
      case 'warning':
        triggerHaptic('notificationWarning');
        break;
      case 'info':
      default:
        triggerHaptic('impactLight');
        break;
    }

    set((state) => {
      const trimmed = state.toasts.slice(-(MAX_CONCURRENT_TOASTS - 1));
      return { toasts: [...trimmed, newToast] };
    });

    return id;
  },
  success: (message, title, options) => {
    return get().show({ ...options, type: 'success', message, title });
  },
  error: (message, title, options) => {
    return get().show({ ...options, type: 'error', message, title });
  },
  warning: (message, title, options) => {
    return get().show({ ...options, type: 'warning', message, title });
  },
  info: (message, title, options) => {
    return get().show({ ...options, type: 'info', message, title });
  },
  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  dismissAll: () => {
    set({ toasts: [] });
  },
}));

export const toast = {
  show: (input: ToastInput) => useToastStore.getState().show(input),
  success: (message: string, title?: string, options?: Partial<ToastInput>) =>
    useToastStore.getState().success(message, title, options),
  error: (message: string, title?: string, options?: Partial<ToastInput>) =>
    useToastStore.getState().error(message, title, options),
  warning: (message: string, title?: string, options?: Partial<ToastInput>) =>
    useToastStore.getState().warning(message, title, options),
  info: (message: string, title?: string, options?: Partial<ToastInput>) =>
    useToastStore.getState().info(message, title, options),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
  dismissAll: () => useToastStore.getState().dismissAll(),
};
