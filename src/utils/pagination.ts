/**
 * Uniform pagination metadata, attached NON-destructively (as an extra
 * `pagination` key) to list responses whose native shapes all differ:
 * orders nest meta under `list.meta`, items use `totalItems` + offset,
 * returns use a top-level `meta`. Original fields are always preserved.
 */

export interface PaginationInfo {
  returned: number;
  totalCount?: number;
  hasMore?: boolean;
  nextCursor?: string;
}

export function makePagination(input: {
  returned: number;
  totalCount?: number | null;
  nextCursor?: string | null;
  offset?: number | null;
}): PaginationInfo {
  const info: PaginationInfo = { returned: input.returned };
  if (typeof input.totalCount === 'number') info.totalCount = input.totalCount;
  if (input.nextCursor) {
    info.nextCursor = input.nextCursor;
    info.hasMore = true;
  } else if (
    typeof input.offset === 'number' &&
    typeof input.totalCount === 'number'
  ) {
    info.hasMore = input.offset + input.returned < input.totalCount;
  }
  return info;
}
