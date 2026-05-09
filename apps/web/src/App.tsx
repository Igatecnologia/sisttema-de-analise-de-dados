import { AppRouter } from './routes/AppRouter'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AppToaster } from './components/feedback/Toast'
import { CookieConsent } from './components/CookieConsent'

function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
      <AppToaster />
      <CookieConsent />
    </AppErrorBoundary>
  )
}

export default App
