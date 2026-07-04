import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ExclusivePage() {
  return (
    <PageContainer pageTitle='Pro Features' pageDescription='Premium features (dev mode)'>
      <Card>
        <CardHeader>
          <CardTitle>Pro Features</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground text-sm'>
            Pro features are accessible in development mode.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
