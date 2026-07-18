const RESERVED_PLATFORM_HOSTS = new Set(["app", "www"]);

export function resolvePlatformProject(hostHeader: string, rootDomain: string): string | null {
  const hostname = hostHeader.toLowerCase().split(":")[0].replace(/\.$/, "");
  const normalizedRoot = rootDomain.toLowerCase().split(":")[0].replace(/^\./, "").replace(/\.$/, "");
  const suffix = `.${normalizedRoot}`;
  if (!hostname.endsWith(suffix)) return null;

  const project = hostname.slice(0, -suffix.length);
  if (!project || project.includes(".") || RESERVED_PLATFORM_HOSTS.has(project)) return null;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project) ? project : null;
}
