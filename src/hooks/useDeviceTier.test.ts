import { describe, it, expect } from 'vitest';

import { tierFor } from './useDeviceTier';

describe('tierFor', () => {
  it('is desktop at lg and up', () => {
    expect(tierFor({ lg: true, md: true })).toBe('desktop');
    expect(tierFor({ lg: true })).toBe('desktop');
  });

  it('is tablet at md but below lg', () => {
    expect(tierFor({ md: true, lg: false })).toBe('tablet');
    expect(tierFor({ md: true })).toBe('tablet');
  });

  it('is mobile below md', () => {
    expect(tierFor({})).toBe('mobile');
    expect(tierFor({ md: false, lg: false })).toBe('mobile');
  });
});
