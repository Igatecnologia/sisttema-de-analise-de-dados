export const AUTH_EVENT_SIGN_OUT = 'app:auth:signout'

export function emitAuthSignOut() {
  window.dispatchEvent(new Event(AUTH_EVENT_SIGN_OUT))
}

export function onAuthSignOut(handler: () => void) {
  window.addEventListener(AUTH_EVENT_SIGN_OUT, handler)
  return () => window.removeEventListener(AUTH_EVENT_SIGN_OUT, handler)
}

