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
import { deleteServiceMutation } from '@/lib/cmdb/services/mutations';
import type { Service } from '@/lib/cmdb/services/types';

export function CellAction({ data }: { data: Service }) {
  const router = useRouter();
  const deleteMutation = useMutation({
    ...deleteServiceMutation,
    onSuccess: () => {
      toast.success(`Service "${data.name}" deleted`);
    },
    onError: () => {
      toast.error('Failed to delete service');
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
        <DropdownMenuItem onClick={() => router.push(`/dashboard/services/${data.id}`)}>
          <Icons.search className='mr-2 h-4 w-4' /> View Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='text-destructive focus:text-destructive'
          onClick={() => {
            if (confirm('Are you sure you want to delete this service?')) {
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
