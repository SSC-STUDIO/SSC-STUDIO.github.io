# Jay Sakura Town media sources

Checked on 2026-09-26.

- Visual reference: [Bilibili BV1Ziac6JEUc](https://www.bilibili.com/video/BV1Ziac6JEUc/), titled "吓哭了！Opus 5.5一轮生成绝美动漫樱花小镇！" by 水母菌Jellyfish. Its public video metadata reports state `0`. It is a style reference, not a visual asset copied into the site.
- Mainland playback source: [Bilibili BV1fx411N7bU](https://www.bilibili.com/video/BV1fx411N7bU/), "【经典】周杰伦全MV 【200P】" by Ta酱-Tatsu. The Bilibili `x/web-interface/view` metadata reports state `0` and 200 parts. Every `page` and `cid` in `songs.ts` was matched against its `pages` array. The [Bilibili external player](https://player.bilibili.com/player.html?isOutside=true&bvid=BV1fx411N7bU&cid=2162145&page=52) returned HTTP 200 for the sample 七里香 part. The platform playback API returned `code=0` for the 七里香 and Mojito CIDs; no media was downloaded. This uploader is not identified as a rights holder; public availability does not establish reuse permission.
- Official fallback: the 20 matching public MV or lyric-video IDs in `songs.ts` were returned by YouTube search with channel ID [`UC8CU5nVhCQIdAGrFFp4loOQ`](https://www.youtube.com/channel/UC8CU5nVhCQIdAGrFFp4loOQ), "周杰倫 Jay Chou". The sample privacy-enhanced YouTube embed returned HTTP 200. Mainland availability and actual playback inside a browser were not verified. 等你下课 uses an official lyrics MV rather than a filmed MV.
- Bilibili also has recent single-video uploads from the "杰威尔音乐" account (mid `1745584728`), including [西西里 BV17mYV6WEe5](https://www.bilibili.com/video/BV17mYV6WEe5/) and [I DO BV1d49WB8EXP](https://www.bilibili.com/video/BV1d49WB8EXP/). These are not used for the 20-song set.

The site embeds platform players and links to source pages. It does not download, bundle, or serve the recordings. Videos may later be removed, restricted, or blocked from embedding by their platforms or rights holders.

Browser verification on the local page: the real 七里香 Bilibili iframe loaded a 302.82-second video; after opening it from the page, its playback time advanced to 6.54 seconds with `paused=false`, `readyState=4`, and no media error. Other tracks were checked against the collection metadata rather than individually played to completion.

Town geometry, storefront artwork, flower textures, road surfaces and other environment textures are drawn locally by this feature's code. No frame or visual asset from the reference video is shipped. The static WebGL fallback at `public/jay-town/scene-poster.webp` is a rendered capture of this town's own scene.
