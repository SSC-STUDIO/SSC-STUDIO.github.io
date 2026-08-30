# 陈润森 · Chen Runsen

个人网站 [chenrunsen.cn](https://chenrunsen.cn)：作品集、文章、实验游戏，以及一处班级记忆现场。

用 **Astro** 构建。视觉身份以「森」字构成、朱砂印章和中文宋体为骨架；动效骨架曾参考 [Antoine Wodniack](https://wodniack.dev) 的开源作品（CC BY-NC 4.0），内容、标志与排版均为重新设计。

## 本地开发

```bash
git clone https://github.com/SSC-STUDIO/chenrunsen-site.git
cd chenrunsen-site
npm install
npm run dev
```

- `npm run build` 产出静态站点
- 开发时 `/api` 经 Vite 代理到本机 `18080`（SSH 隧道连生产）
- `npm run sync:repos` 重新拉取 GitHub 仓库，写入 `src/data/github-repos.json`（项目页的开源仓库区读这份数据）

### GitHub 仓库同步

项目页底部的开源仓库区是**构建期静态数据**，不走客户端请求，因此不受 GitHub 未鉴权限流影响，也能被搜索引擎收录。

- 拉取源：`GITHUB_USER`（默认 `SSC-STUDIO`）的公开仓库，自动排除 fork
- 人工润色写在 `src/data/repo-overrides.json`：中文名、摘要、标签、排序（`order`）、是否隐藏（`hidden`）；重新同步不会覆盖
- 联网失败时保留上一份快照并告警，不会中断构建
- 只想重排/改文案、不联网：`npm run sync:repos -- --offline`

## 许可

动效与部分布局派生自 CC BY-NC 4.0 开源作品，页脚保留署名。站点文案、印章、森标、栏目与交互为陈润森原创，禁止原样套用后当作自己的作品集。
