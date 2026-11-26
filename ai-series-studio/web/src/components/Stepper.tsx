const STEPS = ["Upload idea", "Approve visuals", "Lock voices", "Episode 1", "Review & export"];

/** `current` is the step on screen; `reached` is the furthest step the project has unlocked. */
export default function Stepper({ current, reached, onGo }: { current: number; reached: number; onGo: (n: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n === current ? "current" : n <= reached ? "done" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              disabled={n > reached}
              onClick={() => onGo(n)}
              aria-current={state === "current" ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                state === "current" ? "border-accent bg-accent-soft font-semibold text-ink"
                : state === "done" ? "border-line bg-white text-ink hover:border-stone-400"
                : "border-line bg-white text-muted"}`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${state === "todo" ? "bg-stone-100" : "bg-accent text-white"}`}>
                {state === "done" && n < reached ? "✓" : n}
              </span>
              {label}
            </button>
            {n < STEPS.length && <span className="text-line">—</span>}
          </li>
        );
      })}
    </ol>
  );
}
