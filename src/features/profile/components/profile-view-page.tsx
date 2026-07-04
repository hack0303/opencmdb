import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfileViewPage() {
  return (
    <div className='flex w-full flex-col p-4'>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground text-sm'>
            User profile management is available in development mode.
          </p>
          <div className='mt-4 space-y-2 text-sm'>
            <div>
              <span className='font-medium'>Name:</span> Developer
            </div>
            <div>
              <span className='font-medium'>Email:</span> dev@opencmdb.local
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
