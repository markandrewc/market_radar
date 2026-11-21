import { KpiCard } from './KpiCard';
import { Empty, ErrorMsg, Loading } from './Status';
import { useTargetGroup } from '../api';
import { formatPeriod } from '../lib/source';

const number = (value: number) => Number(value).toLocaleString('de-CH');

/**
 * The four Question-D figures at a glance: one headline number and at most one second figure per card,
 * each with the source popover (publisher date, retrieval date, dataset link when one exists).
 * Nothing is estimated: indicators without a stored record are named instead of filled in.
 */
export function TargetGroupSummary({ region }: { region?: string }) {
  const { data, isLoading, error } = useTargetGroup(region);

  if (isLoading) return <Loading />;
  if (error) return <ErrorMsg />;
  if (!data) return null;

  if (data.kpis.length === 0) {
    return (
      <Empty
        text={`No target-group figures are stored${region ? ` for ${region}` : ''} yet. Run the pipeline (npm run pipeline) and reload this page.`}
      />
    );
  }

  return (
    <section aria-labelledby="target-group-glance" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="target-group-glance" className="text-lg font-semibold text-brand">Target group at a glance</h3>
        <p className="text-xs text-slate-500">
          {region ? `Canton ${region}` : 'Switzerland'} · {data.period ? formatPeriod(data.period) : 'no period stored'}
        </p>
      </div>

      {data.stale && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          At least one of these figures has not been updated for a while. Check the source popover before using it.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            value={
              <>
                {number(kpi.value)}
                <span className="ml-1 text-sm font-medium text-slate-500">{kpi.unit}</span>
              </>
            }
            detail={kpi.secondary !== null && kpi.secondary !== undefined
              ? `${number(kpi.secondary)} ${kpi.secondaryLabel ?? ''}`.trim()
              : undefined}
            changePct={kpi.changePct ?? undefined}
            note={kpi.note ?? undefined}
            source={kpi.source}
          />
        ))}
      </div>

      {data.missing.length > 0 && (
        <p className="text-xs text-slate-500">
          Not stored for this selection: {data.missing.join(', ')}.
        </p>
      )}
    </section>
  );
}
