import { articles, type Article } from '@/data/articles'

export type { Article }

export function readingMinutes(words: number) {
  return Math.max(1, Math.round(words / 400))
}

/** 篇幅尺最短也要看得出一截朱丝 */
export function readingGauge(words: number) {
  return Math.min(Math.max(readingMinutes(words) / 8, 0.28), 1)
}

export function articlePage(slug: string) {
  const index = articles.findIndex((item) => item.slug === slug)
  const article = articles[index]
  if (!article) {
    throw new Error(`unknown article: ${slug}`)
  }

  return {
    article,
    newer: index > 0 ? articles[index - 1] : undefined,
    older: index >= 0 && index < articles.length - 1 ? articles[index + 1] : undefined,
    minutes: readingMinutes(article.words),
  }
}
