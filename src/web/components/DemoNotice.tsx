import { useMocks } from '../api';

/**
 * Marks a section whose data still comes from mocks while the rest of the app reads the API.
 * In full mock mode (VITE_USE_MOCKS=1) the banner in App.tsx already says so, hence nothing here.
 */
export function DemoNotice({ what = 'This page' }: { what?: string }) {
  if (useMocks) return null;
  return (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {what} still shows demo data — there is no backend endpoint for it yet.
    </p>
  );
}
