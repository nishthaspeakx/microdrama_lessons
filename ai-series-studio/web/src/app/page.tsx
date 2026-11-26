import Image from "next/image";
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
    <main className="studio-home">
      <div className="studio-opening">
        <section className="studio-intake" aria-labelledby="intake-title">
          <h1 id="intake-title">Upload your idea</h1>
          <p className="intake-intro">Start with a series brief, a script, or a few lines about the show you want to make.</p>
          <UploadForm />
        </section>
        <figure className="studio-poster">
          <div className="poster-frames">
            <div className="poster-inset">
              <Image src="/madhopur-meera.jpg" alt="Meera looks up in Madhopur" fill sizes="(max-width: 640px) 24vw, 140px" />
            </div>
            <div className="poster-main">
              <Image src="/madhopur-craft.jpg" alt="The spacecraft reveal in Madhopur" fill sizes="(max-width: 640px) 50vw, 270px" priority />
            </div>
          </div>
          <figcaption>
            <p className="poster-title">Madhopur</p>
            <p>Stills from Episode 1</p>
          </figcaption>
        </figure>
      </div>
      <section className="studio-projects" aria-labelledby="projects-title">
        <h2 id="projects-title">Your microdramas</h2>
        {projects.length === 0 && <p className="mt-2 text-sm text-muted">Projects you create will appear here.</p>}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="studio-project-card">
                <p className="font-medium deva">{p.name}</p>
                <p className="mt-1 text-sm text-muted">Step {p.step}: {STEP[p.step]} · {STATUS[p.status] ?? p.status}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
