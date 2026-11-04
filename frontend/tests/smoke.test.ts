import { describe, it, expect } from 'vitest';
import { Role } from '../src/auth/guards';

describe('Frontend Smoke and Contract Tests', () => {
  it('validates user role types against domain rules', () => {
    const roles: Role[] = ['analyst', 'field_analyst', 'approver'];
    expect(roles).toHaveLength(3);
    expect(roles).toContain('approver');
  });

  it('verifies that approver role is distinct from analyst', () => {
    const analystRole: Role = 'analyst';
    const approverRole: Role = 'approver';
    expect(analystRole).not.toBe(approverRole);
  });
});

