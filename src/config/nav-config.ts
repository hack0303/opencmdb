import { NavGroup } from '@/types';

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 * Items are organized into groups, each rendered with a SidebarGroupLabel.
 *
 * RBAC Access Control:
 * Each navigation item can have an `access` property that controls visibility
 * based on permissions, plans, features, roles, and organization context.
 *
 * Examples:
 *
 * 1. Require organization:
 *    access: { requireOrg: true }
 *
 * 2. Require specific permission:
 *    access: { requireOrg: true, permission: 'org:teams:manage' }
 *
 * 3. Require specific plan:
 *    access: { plan: 'pro' }
 *
 * 4. Require specific feature:
 *    access: { feature: 'premium_access' }
 *
 * 5. Require specific role:
 *    access: { role: 'admin' }
 *
 * 6. Multiple conditions (all must be true):
 *    access: { requireOrg: true, permission: 'org:teams:manage', plan: 'pro' }
 *
 * Note: The `visible` function is deprecated but still supported for backward compatibility.
 * Use the `access` property for new items.
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard/overview',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      }
    ]
  },
  {
    label: 'Elements',
    items: [
      {
        title: 'Users',
        url: '/dashboard/users',
        icon: 'teams',
        shortcut: ['u', 'u'],
        isActive: false,
        items: []
      },
      {
        title: 'Domains',
        url: '/dashboard/domains',
        icon: 'workspace',
        shortcut: ['m', 'd'],
        isActive: false,
        items: []
      },
      {
        title: 'Services',
        url: '/dashboard/services',
        icon: 'stack2',
        shortcut: ['m', 's'],
        isActive: false,
        items: []
      },
      {
        title: 'Assets',
        url: '/dashboard/assets',
        icon: 'asset',
        shortcut: ['a', 'a'],
        isActive: false,
        items: []
      }
    ]
  },
  {
    label: '',
    items: [
      {
        title: 'Exclusive',
        url: '/dashboard/exclusive',
        icon: 'exclusive',
        shortcut: ['e', 'e'],
        isActive: false,
        items: []
      },
      {
        title: 'Profile',
        url: '/dashboard/profile',
        icon: 'profile',
        shortcut: ['m', 'm'],
        isActive: false,
        items: []
      },
      {
        title: 'Notifications',
        url: '/dashboard/notifications',
        icon: 'notification',
        shortcut: ['n', 'n'],
        isActive: false,
        items: []
      },
      {
        title: 'Billing',
        url: '/dashboard/billing',
        icon: 'billing',
        shortcut: ['b', 'b'],
        isActive: false,
        items: [],
        access: { requireOrg: true }
      },
      {
        title: 'Login',
        url: '/',
        icon: 'login',
        shortcut: ['l', 'l'],
        isActive: false,
        items: []
      }
    ]
  }
];
