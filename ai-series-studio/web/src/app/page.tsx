import Link from "next/link";
import UploadForm from "@/components/UploadForm";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

const STEP = ["", "Upload idea", "Approve visuals", "Lock voices", "Episode 1", "Review & export"];
const STATUS: Record<string, string> = { extracting: "Reading sources…", intake_ready: "Ready to review", intake_failed: "Needs attention", created: "New" };

export default async function Home() {
  const projects = await q<{ id: string; name: string; step: number; status: string; updated_at: Date }>(
    "SELECT id, name, step, status, updated_at FROM projects ORDER BY updated_at DESC LIMIT 20",
  );
  return (
    <main className="mx-auto grid max-w-7xl gap-12 px-6 py-12 lg:grid-cols-[1fr_340px]">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Upload your idea</h1>
        <p className="mt-2 max-w-xl text-muted">
          Add your series documents and a few lines about the show. We read them, show you what we understood, and flag anything that disagrees before any visuals are made.
        </p>
        <div className="mt-8 max-w-2xl"><UploadForm /></div>
      </section>
      <aside>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your microdramas</h2>
        {projects.length === 0 && <p className="mt-3 text-sm text-muted">Nothing yet.</p>}
        <ul className="mt-3 space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="block rounded-xl border border-line bg-white p-4 hover:border-stone-400">
                <p className="font-medium deva">{p.name}</p>
                <p className="mt-1 text-sm text-muted">Step {p.step}: {STEP[p.step]} · {STATUS[p.status] ?? p.status}</p>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
