import type { MetadataRoute } from "next"

const baseUrl = "https://frontend-teal-beta-ype2l2g0md.vercel.app"

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/console", "/privacy", "/terms"].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/console" ? 0.9 : 0.4,
  }))
}
