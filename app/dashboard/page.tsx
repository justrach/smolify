import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { CreateProjectForm } from "@/components/create-project-form";
import { CustomDomainControl } from "@/components/custom-domain-control";
import { SetupAssistant } from "@/components/setup-assistant";
import { ImportRepositoryForm } from "@/components/import-repository-form";
import { createAuth } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listAccessibleProjects } from "@/lib/projects/access";
import { listProjectProposals } from "@/lib/contributions/repository";
import { ProposalReviewList } from "@/components/proposal-review-list";
import { ProjectVisibilityControl } from "@/components/project-visibility-control";

type DashboardProps = {
  searchParams: Promise<{ project?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto")
    ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const auth = await createAuth(new Request(`${protocol}://${host}/dashboard`, { headers: requestHeaders }));
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect("/login");

  const { env } = await getCloudflareContext({ async: true });
  const [projects, consent] = await Promise.all([
    listAccessibleProjects(env, session.user.id),
    env.DB.prepare("SELECT id FROM oauthConsent WHERE userId = ? LIMIT 1")
      .bind(session.user.id)
      .first<{ id: string }>(),
  ]);
  const requestedProject = (await searchParams).project;
  const selectedProject = projects.find((project) => project.slug === requestedProject)
    ?? projects.find((project) => !project.activeDeploymentId)
    ?? projects[0];
  const publishedCount = projects.filter((project) => project.activeDeploymentId).length;
  const proposals = selectedProject
    ? await listProjectProposals(env, selectedProject.id)
    : [];

  return (
    <main className="dashboard-shell">
      <header>
        <Brand />
        <div className="account-actions"><Link href="/explore">Explore</Link><span>{session.user.email}</span><SignOutButton /></div>
      </header>

      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Your docs workspace</p>
          <h1>Small setup.<br />Docs that know your code.</h1>
          <p>Create a project, authorize Codex, and publish only after you review the generated diff.</p>
        </div>
        <div className="dashboard-primary-actions"><ImportRepositoryForm /><CreateProjectForm /></div>
      </section>

      {projects.length > 0 && (
        <section className="workspace-stats" aria-label="Workspace summary">
          <div><span>{projects.length}</span><p>{projects.length === 1 ? "project" : "projects"}</p></div>
          <div><span>{publishedCount}</span><p>live</p></div>
          <div><span>{consent ? "OAuth" : "—"}</span><p>{consent ? "Codex connected" : "Codex not connected"}</p></div>
        </section>
      )}

      {selectedProject && (
        <>
          <SetupAssistant
            endpoint={env.BETTER_AUTH_URL.replace(/\/$/, "")}
            mcpConnected={Boolean(consent)}
            projectName={selectedProject.name}
            projectSlug={selectedProject.slug}
            published={Boolean(selectedProject.activeDeploymentId)}
          />
          <ProposalReviewList project={selectedProject.slug} proposals={proposals} />
        </>
      )}

      <section className="projects-section" aria-labelledby="projects-heading">
        <div className="section-heading">
          <div><p className="eyebrow">Projects</p><h2 id="projects-heading">Everything you publish</h2></div>
          {projects.length > 1 && <p>Select a project to resume its setup.</p>}
        </div>
        {projects.length ? projects.map((project) => {
          const isPublished = Boolean(project.activeDeploymentId);
          return (
            <article className="project-card" key={project.slug}>
              <div className="project-icon">{project.name.slice(0, 1).toUpperCase()}</div>
              <div>
                <div className="project-title-row"><h3>{project.name}</h3><span className={`project-state ${isPublished ? "live" : "setup"}`}>{isPublished ? "Live" : "Setup"}</span><span className={`project-state ${project.visibility}`}>{project.visibility}</span>{project.pendingProposals > 0 && <span className="project-state proposals">{project.pendingProposals} proposals</span>}</div>
                <p>{project.slug}.{env.SMOLIFY_ROOT_DOMAIN}</p>
              </div>
              <div className="project-actions">
                {isPublished
                  ? project.visibility === "public"
                    ? <a href={`https://${project.slug}.${env.SMOLIFY_ROOT_DOMAIN}`}>View docs ↗</a>
                    : <Link href={`/${project.slug}/introduction`}>View private docs →</Link>
                  : <Link href={`/dashboard?project=${project.slug}#setup`}>Continue setup →</Link>}
                <ProjectVisibilityControl project={project.slug} visibility={project.visibility} />
                <CustomDomainControl
                  project={project.slug}
                  initialDomain={project.domainId && project.hostname && project.domainStatus ? {
                    id: project.domainId,
                    hostname: project.hostname,
                    status: project.domainStatus,
                  } : null}
                />
              </div>
            </article>
          );
        }) : (
          <section className="empty-projects">
            <span className="empty-icon">+</span>
            <h2>Start with one API</h2>
            <p>A project gives Codex a safe publishing target and your docs a home on <code>smol.ly</code>.</p>
          </section>
        )}
      </section>
    </main>
  );
}
