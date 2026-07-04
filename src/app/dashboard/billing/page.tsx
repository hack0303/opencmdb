import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BillingPage() {
  return (
    <PageContainer pageTitle='Billing' pageDescription='Subscription management (dev mode)'>
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground text-sm'>Billing is disabled in development mode.</p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
