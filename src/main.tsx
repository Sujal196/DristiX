import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary, installGlobalErrorLogging } from './components/common/AppErrorBoundary.tsx'
import { AccessibilityProvider } from './accessibility'

installGlobalErrorLogging()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AccessibilityProvider>
        <App />
      </AccessibilityProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
