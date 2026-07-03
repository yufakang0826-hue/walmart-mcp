import { describe, it, expect } from 'vitest';
import { makePagination } from '../../src/utils/pagination.js';

describe('makePagination', () => {
  it('reports hasMore via nextCursor when present', () => {
    expect(makePagination({ returned: 5, totalCount: 372, nextCursor: 'abc' })).toEqual({
      returned: 5,
      totalCount: 372,
      nextCursor: 'abc',
      hasMore: true,
    });
  });

  it('derives hasMore from offset + returned vs totalCount', () => {
    expect(makePagination({ returned: 50, totalCount: 114, offset: 100 })).toMatchObject({
      hasMore: false,
    });
    expect(makePagination({ returned: 50, totalCount: 114, offset: 0 })).toMatchObject({
      hasMore: true,
    });
  });

  it('omits hasMore when it cannot be determined', () => {
    const p = makePagination({ returned: 20 });
    expect(p.returned).toBe(20);
    expect(p.hasMore).toBeUndefined();
    expect(p.totalCount).toBeUndefined();
  });
});
