export type TownSong = {
  id: string
  title: string
  album: string
  year: number
  zone: 0 | 1 | 2 | 3 | 4
  color: string
  sourceUrl: string
  embedUrl: string
  sourceLabel: string
  youtubeUrl: string
  youtubeEmbedUrl: string
}

type SongEntry = Pick<TownSong, 'id' | 'title' | 'album' | 'year' | 'zone' | 'color'> & {
  page: number
  cid: number
  youtubeId: string
}

const BILIBILI_BVID = 'BV1fx411N7bU'

// Each page and CID comes from the public Bilibili collection's video metadata.
const entries: SongEntry[] = [
  { id: 'qi-li-xiang', title: '七里香', album: '七里香', year: 2004, zone: 0, color: '#ef8ea8', page: 52, cid: 2162145, youtubeId: 'Bbp9ZaJD_eA' },
  { id: 'qing-tian', title: '晴天', album: '叶惠美', year: 2003, zone: 0, color: '#e7a77f', page: 38, cid: 2159309, youtubeId: 'DYptgVvkVLQ' },
  { id: 'hua-hai', title: '花海', album: '魔杰座', year: 2008, zone: 0, color: '#df9bc2', page: 110, cid: 2378457, youtubeId: 'q1ww6bDjfiI' },
  { id: 'pu-gong-ying-de-yue-ding', title: '蒲公英的约定', album: '我很忙', year: 2007, zone: 0, color: '#d5b3d6', page: 99, cid: 2165697, youtubeId: 'VitJnr3IySc' },

  { id: 'jian-dan-ai', title: '简单爱', album: '范特西', year: 2001, zone: 1, color: '#f0a487', page: 14, cid: 2154853, youtubeId: 'Y4xCVlyCvX4' },
  { id: 'gao-bai-qi-qiu', title: '告白气球', album: '周杰伦的床边故事', year: 2016, zone: 1, color: '#ef8e9d', page: 178, cid: 16652345, youtubeId: 'bu7nU9Mhpyo' },
  { id: 'deng-ni-xia-ke', title: '等你下课', album: '最伟大的作品', year: 2018, zone: 1, color: '#adc7b4', page: 181, cid: 30460044, youtubeId: 'kfXdP7nZIiE' },
  { id: 'yuan-you-hui', title: '园游会', album: '七里香', year: 2004, zone: 1, color: '#eab76e', page: 59, cid: 2164307, youtubeId: 'IoCoIxkGkVw' },

  { id: 'qing-hua-ci', title: '青花瓷', album: '我很忙', year: 2007, zone: 2, color: '#8bacbe', page: 97, cid: 2165695, youtubeId: 'Z8Mqw0b9ADs' },
  { id: 'dong-feng-po', title: '东风破', album: '叶惠美', year: 2003, zone: 2, color: '#b3b898', page: 40, cid: 2159311, youtubeId: 'qct0JLjaHDc' },
  { id: 'ju-hua-tai', title: '菊花台', album: '依然范特西', year: 2006, zone: 2, color: '#e1bb7d', page: 89, cid: 2165686, youtubeId: 'PdjbRvvJAzg' },
  { id: 'ye-qu', title: '夜曲', album: '十一月的萧邦', year: 2005, zone: 2, color: '#8b9ab5', page: 62, cid: 2164309, youtubeId: '6Q0Pd53mojY' },

  { id: 'dao-xiang', title: '稻香', album: '魔杰座', year: 2008, zone: 3, color: '#d9b475', page: 117, cid: 2466582, youtubeId: 'sHD_z90ZKV0' },
  { id: 'ting-ma-ma-de-hua', title: '听妈妈的话', album: '依然范特西', year: 2006, zone: 3, color: '#a4bd9a', page: 80, cid: 2164323, youtubeId: '_B8RaLCNUZw' },
  { id: 'mojito', title: 'Mojito', album: '最伟大的作品', year: 2020, zone: 3, color: '#9acbc3', page: 186, cid: 763392642, youtubeId: '-biOGdYiF-I' },
  { id: 'yi-lu-xiang-bei', title: '一路向北', album: '十一月的萧邦', year: 2005, zone: 3, color: '#9baacb', page: 75, cid: 2164321, youtubeId: 'L229QDxDakU' },

  { id: 'gui-ji', title: '轨迹', album: '寻找周杰伦 EP', year: 2003, zone: 4, color: '#b8a4bf', page: 48, cid: 2162142, youtubeId: 'SdBwt6pyNwE' },
  { id: 'shan-hu-hai', title: '珊瑚海', album: '十一月的萧邦', year: 2005, zone: 4, color: '#8dc6ce', page: 73, cid: 2164319, youtubeId: 'kYhh1PpsOg4' },
  { id: 'bu-neng-shuo-de-mi-mi', title: '不能说的秘密', album: '不能说的秘密 电影原声带', year: 2007, zone: 4, color: '#baa5ce', page: 92, cid: 135915284, youtubeId: 'uIWypArI73w' },
  { id: 'an-jing', title: '安静', album: '范特西', year: 2001, zone: 4, color: '#9faec0', page: 21, cid: 2156241, youtubeId: '1hI-7vj2FhE' },
]

export const songs: TownSong[] = entries.map(({ page, cid, youtubeId, ...song }) => ({
  ...song,
  sourceUrl: `https://www.bilibili.com/video/${BILIBILI_BVID}/?p=${page}`,
  embedUrl: `https://player.bilibili.com/player.html?isOutside=true&bvid=${BILIBILI_BVID}&cid=${cid}&page=${page}&autoplay=1&muted=0&danmaku=0`,
  sourceLabel: 'B站公开 MV 合集',
  youtubeUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
  youtubeEmbedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
}))
