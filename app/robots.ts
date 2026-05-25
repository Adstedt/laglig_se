import { MetadataRoute } from 'next'

/**
 * AI *training* crawlers — blocked. These ingest our public law pages to train
 * models with no link-back or referral value, while we pay the serving cost.
 *
 * Deliberately NOT blocked (real discovery/referral upside): search & answer-
 * engine crawlers (Claude-SearchBot, OAI-SearchBot, PerplexityBot, Googlebot,
 * Bingbot) and user-initiated fetchers (Claude-User, ChatGPT-User). Also keep
 * `facebookexternalhit` — it powers link-preview cards, not AI training.
 *
 * `Google-Extended` / `Applebot-Extended` are opt-out *tokens*, not crawlers:
 * blocking them excludes us from Gemini/Apple-Intelligence training WITHOUT
 * affecting Google Search or Siri/Spotlight indexing.
 *
 * Matching is case-insensitive per the robots.txt spec. A crawler that matches
 * a named group ignores the `*` group, so these get a clean full disallow.
 */
const AI_TRAINING_BOTS = [
  'ClaudeBot',
  'anthropic-ai',
  'Claude-Web',
  'GPTBot',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'meta-externalagent',
  'FacebookBot',
  'cohere-ai',
]

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/dashboard/', '/settings/'],
      },
      {
        userAgent: AI_TRAINING_BOTS,
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap-index.xml`,
  }
}
