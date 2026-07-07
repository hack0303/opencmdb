'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { deleteDomainMutation } from '@/lib/cmdb/domains/mutations';
import type { Domain } from '@/lib/cmdb/domains/types';

export function CellAction({ data }: { data: Domain }) {
  const router = useRouter();
  const deleteMutation = useMutation({
    ...deleteDomainMutation,
    onSuccess: () => {
      toast.success(`Domain "${data.name}" deleted`);
    },
    onError: () => {
      toast.error('Failed to delete domain');
    }
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='h-8 w-8 p-0'>
          <span className='sr-only'>Open menu</span>
          <Icons.ellipsis className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => router.push(`/dashboard/domains/${data.id}`)}>
          <Icons.search className='mr-2 h-4 w-4' /> View Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='text-destructive focus:text-destructive'
          onClick={() => {
            if (confirm('Are you sure you want to delete this domain?')) {
              deleteMutation.mutate(data.id);
            }
          }}
        >
          <Icons.trash className='mr-2 h-4 w-4' /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
