/** 卷号：与 projects.ts 数组顺序对齐，不改路由。 */
export const PROJECT_VOLUMES = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌'] as const

export function projectVolume(index: number): string {
  return PROJECT_VOLUMES[index] ?? String(index + 1)
}
