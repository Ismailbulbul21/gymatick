import { useNavigate } from 'react-router'
import { Compass } from 'lucide-react'
import { GymatickLogo } from '@/components/brand/Logo'
import { Button, Card, EmptyState } from '@/components/ui/primitives'
import { tr } from '@/i18n'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="grid min-h-svh place-items-center bg-canvas p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <GymatickLogo onDark={false} />
        <Card className="w-full p-8">
          <EmptyState
            icon={<Compass className="size-6" />}
            title={tr("Page not found")}
            description={tr("This address does not exist in GYMATICK. The link may be old or mistyped.")}
            actions={
              <>
                <Button onClick={() => navigate(-1)}>{tr("Go back")}</Button>
                <Button variant="primary" onClick={() => navigate('/dashboard')}>
                  {tr("Open dashboard")}
                </Button>
              </>
            }
          />
        </Card>
      </div>
    </div>
  )
}
