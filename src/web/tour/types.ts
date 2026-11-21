/** The guided tour: a spotlight over the real interface instead of a wall of text. */

export type TourMode = 'quick' | 'full';

export interface TourStep {
  id: string;
  /** Route the tour moves to before looking for the target. */
  route?: string;
  /** Value of the `data-tour` attribute on the element to highlight. */
  target?: string;
  title: string;
  body: string;
  /** Practical instruction shown for click-to-advance steps. */
  hint?: string;
  /** Advance when the visitor actually clicks something inside the target. */
  waitForClick?: boolean;
}
