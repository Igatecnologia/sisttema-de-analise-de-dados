import { Toaster, toast } from 'react-hot-toast'

export const appToast = {
  success(message: string) {
    toast.success(message, { duration: 4000, ariaProps: { role: 'status', 'aria-live': 'polite' } })
  },
  error(message: string) {
    toast.error(message, { duration: 5000, ariaProps: { role: 'alert', 'aria-live': 'assertive' } })
  },
  warning(message: string) {
    toast(message, { icon: '⚠️', duration: 4500, ariaProps: { role: 'alert', 'aria-live': 'assertive' } })
  },
  info(message: string) {
    toast(message, { icon: 'ℹ️', duration: 4000, ariaProps: { role: 'status', 'aria-live': 'polite' } })
  },
}

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          border: '1px solid var(--qc-border)',
          background: 'var(--qc-surface)',
          color: 'var(--qc-text)',
        },
        duration: 4000,
        ariaProps: { role: 'status', 'aria-live': 'polite' },
      }}
      gutter={10}
      containerStyle={{ top: 16, right: 16 }}
      reverseOrder={false}
    />
  )
}
