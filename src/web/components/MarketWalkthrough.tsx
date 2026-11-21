import { useEffect, useRef, useState } from 'react';

const steps = [
  {
    title: 'Check what the numbers cover',
    instruction: 'Start with the source and date. The job figures are a sample from ITBoard. The skills for each role come from a separate, dated profile.',
    section: '#sources',
    link: 'Open data sources',
  },
  {
    title: 'Pick a role and read its skills',
    instruction: 'Choose a role you train for. See which skills appear often and how many listings the profile counted. One listing can mention several skills.',
    section: '#roles',
    link: 'Explore roles and skills',
  },
  {
    title: 'Compare the change over time',
    instruction: 'Compare the same skill across months. Use the share of listings when the sample size changes. Check the label to see whether the figures cover all sampled IT jobs or a specific role.',
    section: '#skill-trends',
    link: 'Open the monthly skills comparison',
  },
  {
    title: 'Check changes to work permits',
    instruction: 'Read the date and follow the official source to see when a change takes effect and which residence statuses it covers.',
    section: '#policy',
    link: 'Open policy sources',
  },
  {
    title: 'Choose a practical next step',
    instruction: 'Pick one skill to discuss for the next course. Bring the role, the data date and a source link to the training team, along with any gaps in the evidence.',
    section: '#context',
    link: 'Review the market context',
  },
];

const action = 'rounded-lg border px-3 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700';
const primaryAction = `${action} border-teal-800 bg-teal-800 text-white hover:bg-teal-900`;
const secondaryAction = `${action} border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-white`;

export default function MarketWalkthrough() {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const wasOpened = useRef(false);
  const step = stepIndex === null ? null : steps[stepIndex];

  useEffect(() => {
    if (stepIndex !== null) {
      wasOpened.current = true;
      stepHeading.current?.focus();
    } else if (wasOpened.current) {
      launcher.current?.focus();
    }
  }, [stepIndex]);

  return (
    <section id="walkthrough" aria-labelledby="market-tour-title" className="rounded-xl border border-teal-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="market-tour-title" className="text-base font-semibold text-slate-900">Guided tour</h2>
          <p className="mt-1">See where to check demand and decide what to teach next.</p>
        </div>
        <button
          ref={launcher}
          type="button"
          className={primaryAction}
          aria-expanded={step !== null}
          aria-controls="market-tour-steps"
          onClick={() => setStepIndex(stepIndex === null ? 0 : null)}
        >
          {step ? 'Close tour' : 'Start tour'}
        </button>
      </div>

      <div id="market-tour-steps" hidden={step === null} onKeyDown={event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        setStepIndex(null);
      }}>
        {step && stepIndex !== null && (
          <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/70 p-4">
            <h3 ref={stepHeading} tabIndex={-1} className="w-fit rounded font-semibold text-slate-900 focus:outline-2 focus:outline-offset-4 focus:outline-teal-700">
              <span className="mb-1 block text-xs font-medium text-teal-800">Step {stepIndex + 1} of {steps.length}</span>
              {step.title}
            </h3>
            <p className="mt-2 max-w-2xl">{step.instruction}</p>
            <a href={step.section} className="mt-2 inline-block font-semibold text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">{step.link}</a>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={secondaryAction} disabled={stepIndex === 0} onClick={() => setStepIndex(stepIndex - 1)}>Back</button>
              <button type="button" className={primaryAction} onClick={() => setStepIndex(stepIndex === steps.length - 1 ? null : stepIndex + 1)}>
                {stepIndex === steps.length - 1 ? 'Finish tour' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
