import { describe, expect, it } from 'vitest';
import { accountFields } from './settings';

describe('accountFields', () => {
  it('maps only fields returned by auth/me', () => {
    expect(accountFields({ id: 'user-1', name: 'FlowForge Demo', email: 'demo@example.test', role: 'USER' })).toEqual([
      { label: 'Name', value: 'FlowForge Demo' },
      { label: 'Email', value: 'demo@example.test' },
      { label: 'Role', value: 'USER' },
      { label: 'User ID', value: 'user-1' },
    ]);
  });
});
