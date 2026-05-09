import { Toaster } from 'react-hot-toast'

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
