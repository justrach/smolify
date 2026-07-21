export default function DocsLoading() {
  return (
    <div className="docs-shell docs-loading" aria-label="Loading documentation" aria-busy="true">
      <header className="docs-header">
        <span className="docs-loading-line docs-loading-brand" />
        <span className="docs-loading-line docs-loading-search" />
      </header>
      <aside className="docs-sidebar">
        <span className="docs-loading-line" />
        <span className="docs-loading-line" />
        <span className="docs-loading-line" />
        <span className="docs-loading-line" />
      </aside>
      <main className="docs-main">
        <span className="docs-loading-line docs-loading-kicker" />
        <span className="docs-loading-line docs-loading-title" />
        <span className="docs-loading-line" />
        <span className="docs-loading-line" />
        <span className="docs-loading-line docs-loading-short" />
      </main>
    </div>
  );
}
