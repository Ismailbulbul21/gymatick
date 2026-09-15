import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { Button, Card, EmptyState } from '@/components/ui/primitives'
import { errorMessage } from '@/lib/errors'
import { tr } from '@/i18n'

/** One failing screen never takes the whole app down. */
export function RouteError() {
  const error = useRouteError()
  const navigate = useNavigate()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="grid min-h-[60svh] place-items-center p-6">
      <Card className="w-full max-w-lg p-8">
        <EmptyState
          icon={<TriangleAlert className="size-6" />}
          title={notFound ? tr("Page not found") : tr("Something went wrong on this page")}
          description={notFound ? tr("The page you were looking for does not exist.") : errorMessage(error)}
          actions={
            <>
              <Button variant="primary" onClick={() => window.location.reload()}>{tr("Reload page")}</Button>
              <Button onClick={() => navigate('/dashboard')}>{tr("Go to dashboard")}</Button>
            </>
          }
        />
      </Card>
    </div>
  )
}
