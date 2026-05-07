import { toast } from 'react-hot-toast'

export const appToast = {
  success(message: string) {
    toast.success(message, { duration: 4000, ariaProps: { role: 'status', 'aria-live': 'polite' } })
  },
  error(message: string) {
    toast.error(message, { duration: 5000, ariaProps: { role: 'alert', 'aria-live': 'assertive' } })
  },
  warning(message: string) {
    toast(message, { icon: '!', duration: 4500, ariaProps: { role: 'alert', 'aria-live': 'assertive' } })
  },
  info(message: string) {
    toast(message, { icon: 'i', duration: 4000, ariaProps: { role: 'status', 'aria-live': 'polite' } })
  },
}
