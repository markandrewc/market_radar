import * as React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...p }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...p} />
    </div>
  );
}
export const TableHeader = (p: React.ComponentProps<'thead'>) => <thead {...p} />;
export const TableBody = (p: React.ComponentProps<'tbody'>) => <tbody {...p} />;
export const TableRow = ({ className, ...p }: React.ComponentProps<'tr'>) => (
  <tr className={cn('border-b border-slate-100 last:border-0', className)} {...p} />
);
export const TableHead = ({ className, ...p }: React.ComponentProps<'th'>) => (
  <th scope="col" className={cn('h-9 px-3 text-left text-xs font-medium text-slate-600', className)} {...p} />
);
export const TableCell = ({ className, ...p }: React.ComponentProps<'td'>) => (
  <td className={cn('px-3 py-2.5', className)} {...p} />
);

export const TableCaption = ({ className, ...p }: React.ComponentProps<'caption'>) => <caption className={cn('sr-only', className)} {...p} />;
