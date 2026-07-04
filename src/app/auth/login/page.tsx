'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <form action='/api/auth/login' method='POST' className='space-y-4'>
      {error && (
        <p className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
          {error === 'invalid' && 'Invalid username or password'}
          {error === 'required' && 'Username and password are required'}
          {!['invalid', 'required'].includes(error) && 'Login failed'}
        </p>
      )}
      <div className='space-y-2'>
        <Label htmlFor='username'>Username</Label>
        <Input
          id='username'
          name='username'
          type='text'
          placeholder='opencmdb'
          required
          autoFocus
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='password'>Password</Label>
        <Input id='password' name='password' type='password' placeholder='••••••••' required />
      </div>
      <Button type='submit' className='w-full'>
        Sign in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4'>
      <Card className='w-full max-w-sm shadow-lg'>
        <CardHeader className='space-y-1 text-center'>
          <div className='mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary'>
            <Icons.asset className='h-6 w-6 text-primary-foreground' />
          </div>
          <CardTitle className='text-xl'>OpenCMDB</CardTitle>
          <CardDescription>Sign in to access the asset management system</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          <p className='mt-4 text-center text-xs text-muted-foreground'>
            Default credentials: <span className='font-mono font-medium'>opencmdb</span> /{' '}
            <span className='font-mono font-medium'>opencmdb</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
