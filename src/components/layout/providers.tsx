'use client';
import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import { AuthProvider } from '@/lib/auth-context';
import QueryProvider from './query-provider';

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <ActiveThemeProvider initialTheme={activeThemeValue}>
      <AuthProvider>
        <QueryProvider>{children}</QueryProvider>
      </AuthProvider>
    </ActiveThemeProvider>
  );
}
