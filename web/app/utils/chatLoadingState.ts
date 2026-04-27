export function loadingChatSkeletonCount(previousMessageCount: number, options: { min?: number, max?: number } = {}) {
  const min = options.min ?? 3
  const max = options.max ?? 8
  const safeCount = Number.isFinite(previousMessageCount) ? Math.max(0, Math.floor(previousMessageCount)) : 0

  return Math.min(Math.max(safeCount, min), max)
}
