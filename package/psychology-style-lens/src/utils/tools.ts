export function 包含忽略大小写(目标文本: string, 关键词: string): boolean {
  return 目标文本.toLowerCase().includes(关键词.trim().toLowerCase())
}
