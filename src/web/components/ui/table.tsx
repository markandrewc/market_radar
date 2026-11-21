import * as React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...p }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...p} />
    </div>
  );
}
export const TableHeader = ({ className, ...p }: React.ComponentProps<'thead'>) => (
  <thead className={cn('border-b border-line', className)} {...p} />
);
export const TableBody = (p: React.ComponentProps<'tbody'>) => <tbody {...p} />;
export const TableRow = ({ className, ...p }: React.ComponentProps<'tr'>) => (
  <tr className={cn('border-b border-line transition-colors last:border-0 hover:bg-paper', className)} {...p} />
);
export const TableHead = ({ className, ...p }: React.ComponentProps<'th'>) => (
  <th scope="col" className={cn('h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-soft', className)} {...p} />
);
export const TableCell = ({ className, ...p }: React.ComponentProps<'td'>) => (
  <td className={cn('px-3 py-3 align-middle', className)} {...p} />
);

export const TableCaption = ({ className, ...p }: React.ComponentProps<'caption'>) => <caption className={cn('sr-only', className)} {...p} />;
