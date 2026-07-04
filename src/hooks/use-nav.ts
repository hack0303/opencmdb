'use client';

/**
 * Client-side hook for filtering navigation items based on user context
 *
 * Uses our auth context instead of Clerk for development.
 * Navigation items with `requireOrg` are always visible (dev mode).
 */

import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { NavItem, NavGroup } from '@/types';

export function useFilteredNavItems(items: NavItem[]) {
  const { user } = useAuth();

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (!item.access) return true;
        // In dev mode, show all items regardless of org/permissions
        if (item.access.requireOrg) return true;
        if (item.access.permission) return true;
        if (item.access.role) return true;
        return true;
      })
      .map((item) => {
        if (item.items && item.items.length > 0) {
          return {
            ...item,
            items: item.items.filter((childItem) => {
              if (!childItem.access) return true;
              return true; // Show all in dev mode
            })
          };
        }
        return item;
      });
  }, [items, user]);

  return filteredItems;
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const filteredItems = useFilteredNavItems(allItems);

  return useMemo(() => {
    const filteredSet = new Set(filteredItems.map((item) => item.title));
    return groups
      .map((group) => ({
        ...group,
        items: filteredItems.filter((item) =>
          group.items.some((gi) => gi.title === item.title && filteredSet.has(gi.title))
        )
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, filteredItems]);
}
