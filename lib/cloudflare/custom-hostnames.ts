export type CustomHostnameValidationRecord = {
  status?: string;
  txt_name?: string;
  txt_value?: string;
  http_url?: string;
  http_body?: string;
};

export type CloudflareCustomHostname = {
  id: string;
  hostname: string;
  status?: string;
  verification_errors?: Array<{ message?: string } | string>;
  ownership_verification?: { name?: string; type?: string; value?: string };
  ownership_verification_http?: { http_url?: string; http_body?: string };
  ssl?: {
    status?: string;
    validation_errors?: Array<{ message?: string } | string>;
    validation_records?: CustomHostnameValidationRecord[];
  };
};

type CloudflareResponse<T> = {
  success: boolean;
  result?: T;
  errors?: Array<{ message?: string }>;
};

export function normalizeCustomHostname(value: string): string {
  const hostname = value.trim().toLowerCase().replace(/\.$/, "");
  if (hostname.length < 4 || hostname.length > 253 || hostname.includes(":")) {
    throw new Error("Enter a valid hostname");
  }
  const labels = hostname.split(".");
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    throw new Error("Enter a valid hostname");
  }
  return hostname;
}

export function customHostnameState(hostname: CloudflareCustomHostname) {
  const active = hostname.status === "active" && hostname.ssl?.status === "active";
  const failedStatuses = new Set([
    "blocked",
    "deleted",
    "test_blocked",
    "test_failed",
    "validation_timed_out",
    "issuance_timed_out",
    "deployment_timed_out",
  ]);
  const errors = [
    ...(hostname.verification_errors ?? []),
    ...(hostname.ssl?.validation_errors ?? []),
  ]
    .map((error) => (typeof error === "string" ? error : error.message))
    .filter((error): error is string => Boolean(error));

  return {
    status: active
      ? ("active" as const)
      : failedStatuses.has(hostname.status ?? "") || failedStatuses.has(hostname.ssl?.status ?? "")
        ? ("failed" as const)
        : ("verifying" as const),
    errors,
    validation: {
      ownership: hostname.ownership_verification,
      ownershipHttp: hostname.ownership_verification_http,
      certificate: hostname.ssl?.validation_records ?? [],
    },
  };
}

function configuration(env: CloudflareEnv) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) {
    throw new Error("Custom domains are not configured for this Smolify installation");
  }
  return { token: env.CLOUDFLARE_API_TOKEN, zoneId: env.CLOUDFLARE_ZONE_ID };
}

async function cloudflareRequest<T>(env: CloudflareEnv, path: string, init?: RequestInit): Promise<T> {
  const { token, zoneId } = configuration(env);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/custom_hostnames${path}`,
    {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...init?.headers,
      },
    },
  );
  const payload = (await response.json().catch(() => null)) as CloudflareResponse<T> | null;
  if (!response.ok || !payload?.success || !payload.result) {
    const message = payload?.errors?.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(message || `Cloudflare custom-hostname request failed (${response.status})`);
  }
  return payload.result;
}

export function createCloudflareCustomHostname(
  env: CloudflareEnv,
  hostname: string,
  projectId: string,
) {
  return cloudflareRequest<CloudflareCustomHostname>(env, "", {
    method: "POST",
    body: JSON.stringify({
      hostname,
      custom_metadata: { smolify_project_id: projectId },
      ssl: { method: "txt", type: "dv", settings: { min_tls_version: "1.2" } },
    }),
  });
}

export function getCloudflareCustomHostname(env: CloudflareEnv, id: string) {
  return cloudflareRequest<CloudflareCustomHostname>(env, `/${encodeURIComponent(id)}`);
}
