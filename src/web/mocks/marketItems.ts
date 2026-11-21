import type { MarketItem } from '../../shared/types';
import items from './market-items.json';

// 30 realistic records across categories A-E, used while VITE_USE_MOCKS is on.
// The JSON is the single source of truth: `npm run check:contract` validates it
// against docs/market-item.schema.json, the backend returns exactly this shape.
export const mockMarketItems = (): MarketItem[] => items as unknown as MarketItem[];
