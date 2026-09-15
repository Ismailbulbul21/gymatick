import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import './index.css'
import { queryClient } from '@/lib/query-client'
import { router } from '@/app/router'
import { SessionProvider } from '@/app/providers/SessionProvider'
import { ThemeProvider } from '@/app/providers/ThemeProvider'
import { OfflineBanner } from '@/components/feedback/OfflineBanner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <OfflineBanner />
          <RouterProvider router={router} />
          <Toaster position="bottom-right" richColors closeButton toastOptions={{ duration: 5000 }} />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
