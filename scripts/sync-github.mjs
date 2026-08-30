#!/usr/bin/env node
/**
 * sync-github — 把 GitHub 仓库同步进站点数据
 *
 * 用法：
 *   npm run sync:repos            # 拉取并合并覆写，写入 src/data/github-repos.json
 *   npm run sync:repos -- --offline  # 不联网，仅按覆写重排/重命名现有快照
 *
 * 设计取舍：
 * - 构建期生成静态 JSON（而非客户端请求），避免 GitHub 未鉴权 60 次/小时的限额，
 *   也让仓库数据进入静态 HTML、可被搜索引擎收录。
 * - 拉取失败不会中断构建：保留上一份快照，只打印告警。
 * - 中文标题/摘要/标签/排序写在 repo-overrides.json，重新同步不会冲掉人工润色。
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

const USER = process.env.GITHUB_USER || 'SSC-STUDIO'
const OFFLINE = process.argv.includes('--offline')

const DATA_FILE = resolve(HERE, '../src/data/github-repos.json')
const OVERRIDE_FILE = resolve(HERE, '../src/data/repo-overrides.json')

const API = `https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

/**
 * 归一化：GitHub 原始字段 → 页面可直接消费的形状
 */
function normalize(repo, override = {}) {
  const pushedAt = repo.pushed_at ? repo.pushed_at.slice(0, 10) : ''
  const createdAt = repo.created_at ? repo.created_at.slice(0, 10) : ''

  const tags =
    override.tags && override.tags.length
      ? override.tags
      : [repo.language, ...(repo.topics || []).slice(0, 3)].filter(Boolean)

  return {
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    homepage: repo.homepage || '',
    /** 中文名优先，回落仓库名 */
    title: override.title || repo.name,
    /** 中文摘要优先，回落 GitHub 描述 */
    summary: override.summary || repo.description || '（暂无描述）',
    description: repo.description || '',
    language: repo.language || '',
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    license: repo.license?.spdx_id || '',
    topics: repo.topics || [],
    tags,
    archived: !!repo.archived,
    fork: !!repo.fork,
    createdAt,
    pushedAt,
    order: override.order ?? 999,
    hidden: !!override.hidden,
  }
}

async function fetchRepos() {
  const response = await fetch(API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'chenrunsen-website-sync',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function main() {
  const overrides = await readJson(OVERRIDE_FILE, { repos: {} })
  const previous = await readJson(DATA_FILE, null)

  let raw = previous?.repos ?? []
  let source = 'snapshot'

  if (!OFFLINE) {
    try {
      raw = await fetchRepos()
      source = 'github'
    } catch (error) {
      // 拉取失败：保留旧快照，让构建继续
      if (!previous?.repos?.length) throw error

      console.warn(
        `⚠ GitHub 拉取失败（${error.message}），沿用 ${previous.generatedAt} 的快照`
      )
    }
  }

  // 旧快照里缺少原始字段（如 topics/description），用覆写补全展示层信息
  const repos = raw
    .map((repo) => normalize(repo, overrides.repos?.[repo.name]))
    .filter((repo) => !repo.hidden)
    .filter((repo) => !repo.fork || overrides.repos?.[repo.name]?.include)
    .sort(
      (a, b) =>
        a.order - b.order ||
        b.stars - a.stars ||
        b.pushedAt.localeCompare(a.pushedAt)
    )

  const payload = {
    user: USER,
    generatedAt: new Date().toISOString(),
    source,
    count: repos.length,
    repos,
  }

  await mkdir(dirname(DATA_FILE), { recursive: true })
  await writeFile(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(
    `✓ ${repos.length} 个仓库已写入 src/data/github-repos.json（来源：${source}）`
  )
}

main().catch((error) => {
  console.error('✗ 同步失败：', error.message)
  process.exit(1)
})
