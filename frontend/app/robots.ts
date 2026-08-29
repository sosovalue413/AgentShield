import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://frontend-teal-beta-ype2l2g0md.vercel.app/sitemap.xml",
  }
}
