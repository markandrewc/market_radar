import type { ReactNode } from 'react';
import type { Insight, SourceRef } from '../../shared/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Interpretation } from './Interpretation';
import { SourceInfo } from './SourceInfo';

/**
 * The frame every chart lives in: a heading and help text, the chart itself, and a
 * footer with our reading, a "Show numbers" table for screen readers and anyone who
 * prefers figures, and the sources the chart is built from.
 */
export function ChartFrame({
  title,
  description,
  badge,
  filters,
  children,
  numbers,
  interpretation,
  sources,
  className,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  numbers?: { caption: string; head: string[]; rows: (string | number)[][] };
  interpretation?: Insight;
  sources?: SourceRef[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold text-brand">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
            {badge && <div className="flex flex-wrap items-center gap-2 pt-0.5">{badge}</div>}
          </div>
          {filters && <div className="shrink-0">{filters}</div>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>{children}</div>

        {interpretation && <Interpretation insight={interpretation} />}

        {numbers && (
          <details className="rounded-md border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-brand">Show numbers</summary>
            <div className="max-h-72 overflow-y-auto pt-2" tabIndex={0} role="region" aria-label={`Table: ${numbers.caption}`}>
              <Table>
                <TableCaption>{numbers.caption}</TableCaption>
                <TableHeader>
                  <TableRow>
                    {numbers.head.map((heading, index) => (
                      <TableHead key={`${heading}-${index}`}>{heading}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numbers.rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        )}

        {sources && sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-medium text-slate-500">{sources.length > 1 ? 'Sources' : 'Source'}</span>
            {sources.map((source, index) => (
              <SourceInfo key={`${source.id}-${index}`} source={source} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
