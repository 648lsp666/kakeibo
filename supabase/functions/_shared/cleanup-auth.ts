export function isCleanupRequestAuthorized(provided: string, expected: string): boolean {
  if (expected.length < 16 || provided.length < 16) return false
  let difference = provided.length ^ expected.length
  const length = Math.max(provided.length, expected.length)
  for (let index = 0; index < length; index++) {
    difference |= (provided.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0)
  }
  return difference === 0
}
