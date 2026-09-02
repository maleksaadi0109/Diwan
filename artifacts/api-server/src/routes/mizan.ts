import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const MIZAN_BASE_URL = "https://mizanalarab.com";

function isSafePoemId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,40}$/.test(value);
}

// Proxies mizanalarab.com's poem API server-side. The site has no CORS
// allow-origin header, so a browser (web preview, and any future web
// deployment) cannot fetch it directly — only native app fetches are
// unaffected by CORS. Routing through our own server avoids that entirely.
router.get("/mizan/poem/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!isSafePoemId(id)) {
    res.status(400).json({ error_code: "INVALID_POEM_ID", error_message: "معرف القصيدة غير صالح" });
    return;
  }

  try {
    const upstream = await fetch(`${MIZAN_BASE_URL}/api/poems/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) {
      res.status(502).json({
        error_code: "MIZAN_FETCH_FAILED",
        error_message: `فشل جلب القصيدة من ميزان العرب (HTTP ${upstream.status})`,
      });
      return;
    }
    const data = await upstream.json();
    res.json(data);
  } catch (error) {
    logger.warn({ err: error, id }, "Mizan Al-Arab poem fetch failed");
    res.status(502).json({
      error_code: "MIZAN_FETCH_FAILED",
      error_message: "تعذر الاتصال بموقع ميزان العرب، حاول مرة أخرى",
    });
  }
});

export default router;
