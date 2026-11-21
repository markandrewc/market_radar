import type { ReactNode } from 'react';
import type { Insight, SourceRef } from '../../shared/types';
import { Card, CardDescription, CardTitle } from './ui/card';
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
  kicker,
  badge,
  filters,
  children,
  numbers,
  interpretation,
  sources,
  tourId,
  className,
}: {
  title: string;
  description?: string;
  /** Optional section kicker above the title, e.g. "DEMAND". */
  kicker?: string;
  badge?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  numbers?: { caption: string; head: string[]; rows: (string | number)[][] };
  interpretation?: Insight;
  sources?: SourceRef[];
  /** Optional data-tour anchor for the source footer (guided tour). */
  tourId?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0 space-y-1.5">
          {kicker && <p className="kicker">{kicker}</p>}
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="max-w-prose text-sm leading-relaxed text-ink-soft">{description}</CardDescription>}
          {badge && <div className="flex flex-wrap items-center gap-2 pt-1">{badge}</div>}
        </div>
        {filters && <div className="shrink-0">{filters}</div>}
      </div>

      <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
        {/* The chart reads as one inset sheet of paper, not another nested card. */}
        <div className="rounded-card border border-line bg-paper/60 p-3 sm:p-4">{children}</div>

        {interpretation && <Interpretation insight={interpretation} />}

        {numbers && (
          <details className="rounded-card border border-line bg-paper/60 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink hover:text-brand-accent">
              Show numbers
            </summary>
            <div className="max-h-72 overflow-y-auto pt-3" tabIndex={0} role="region" aria-label={`Table: ${numbers.caption}`}>
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
                        <TableCell key={cellIndex} className="tnum">{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        )}

        {sources && sources.length > 0 && (
          <div data-tour={tourId} className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="text-xs font-medium text-ink-soft">{sources.length > 1 ? 'Sources' : 'Source'}</span>
            {sources.map((source, index) => (
              <SourceInfo key={`${source.id}-${index}`} source={source} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
