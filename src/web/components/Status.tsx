export const Loading = () => <p className="text-slate-500">Loading…</p>;
export const ErrorMsg = () => <p className="text-red-700">Something went wrong. Please try again.</p>;
export const Empty = ({ text }: { text: string }) => <p className="text-slate-500">{text}</p>;
