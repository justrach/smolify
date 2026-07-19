import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/explore", "/mcp"],
      disallow: ["/dashboard", "/login", "/consent", "/api/"],
    },
    sitemap: "https://app.smol.ly/sitemap.xml",
    host: "https://app.smol.ly",
  };
}
