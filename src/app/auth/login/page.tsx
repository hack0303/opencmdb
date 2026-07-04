'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || 'Login failed');
          setLoading(false);
          return;
        }

        // Success — cookie was set in the response
        toast.success('Welcome to OpenCMDB');

        // Navigate to dashboard (full page load ensures middleware validates cookie)
        // Use setTimeout to ensure toast renders before navigation
        setTimeout(() => {
          window.location.href = '/dashboard/assets';
        }, 300);
      } catch (err) {
        setError('Network error — is the server running?');
        setLoading(false);
      }
    },
    [username, password]
  );

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
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='username'>Username</Label>
              <Input
                id='username'
                type='text'
                placeholder='opencmdb'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                type='password'
                placeholder='••••••••'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>{error}</p>
            )}
            <Button type='submit' className='w-full' isLoading={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <p className='mt-4 text-center text-xs text-muted-foreground'>
            Default credentials: <span className='font-mono font-medium'>opencmdb</span> /{' '}
            <span className='font-mono font-medium'>opencmdb</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
