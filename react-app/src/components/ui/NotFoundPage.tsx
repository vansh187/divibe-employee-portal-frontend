import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-100 px-6 text-center">
      <p className="font-display text-3xl text-forest-800">404</p>
      <p className="max-w-sm text-sm text-ink-500">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link to="/dashboard">
        <Button>Go to Dashboard</Button>
      </Link>
    </div>
  )
}
