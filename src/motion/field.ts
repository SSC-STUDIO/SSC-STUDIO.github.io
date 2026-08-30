/**
 * 场噪声 —— 山脊与水波的底层随机场
 *
 * 不是 Perlin 梯度噪声的移植：这里用整数哈希直接取格点值，
 * 五次方缓动做双线性混合（值噪声），再按倍频叠加成 fBm。
 * 值噪声的轮廓比梯度噪声更圆钝，恰好贴合水墨山峦的缓坡剪影。
 */

/** mulberry32：极小的播种伪随机数发生器，同种子可复现 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 二维整数格点哈希到 [-1, 1]，盐值决定整个场的形态 */
function hashLattice(x: number, y: number, salt: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ salt
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 2147483648 - 1
}

/** 五次方缓动：端点处一阶、二阶导均为零，格点上看不出折痕 */
function quintic(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export type Field2D = {
  /** 单层值噪声，返回 [-1, 1] */
  sample(x: number, y: number): number
  /** 分形叠加（fBm），返回约 [-1, 1]，octaves 越多细节越碎 */
  fbm(x: number, y: number, octaves?: number): number
}

export function createField(seed = 1): Field2D {
  // 种子先过一遍 PRNG 搅匀，避免相近种子产出相近的场
  const salt =
    Math.floor(mulberry32(Math.floor(seed * 1e9) || 1)() * 0xffffffff) | 0

  function sample(x: number, y: number): number {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const tx = quintic(x - x0)
    const ty = quintic(y - y0)

    const v00 = hashLattice(x0, y0, salt)
    const v10 = hashLattice(x0 + 1, y0, salt)
    const v01 = hashLattice(x0, y0 + 1, salt)
    const v11 = hashLattice(x0 + 1, y0 + 1, salt)

    const top = v00 + (v10 - v00) * tx
    const bottom = v01 + (v11 - v01) * tx

    return top + (bottom - top) * ty
  }

  function fbm(x: number, y: number, octaves = 4): number {
    let sum = 0
    let amplitude = 0.5
    let frequency = 1
    let norm = 0

    for (let i = 0; i < octaves; i++) {
      sum += sample(x * frequency, y * frequency) * amplitude
      norm += amplitude
      amplitude *= 0.5
      frequency *= 2
    }

    return sum / norm
  }

  return { sample, fbm }
}
