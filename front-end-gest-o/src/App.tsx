import { AppRouter } from './routes/AppRouter'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AppToaster } from './components/feedback/Toast'

function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
      <AppToaster />
    </AppErrorBoundary>
  )
}

export default App
