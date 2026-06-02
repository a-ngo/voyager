import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AssistantPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="AI Assistant"
        description="Conversational portfolio intelligence, powered by Claude."
      />
      <Card>
        <CardHeader>
          <CardTitle>Beta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted">
            Ask questions about your allocation, drift, and performance. A minimal, anonymized
            portfolio summary is sent to Anthropic server-side — never raw transactions. Not
            financial advice.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
