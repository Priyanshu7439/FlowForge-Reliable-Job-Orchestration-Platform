import type { AuthUser } from './types';

export interface AccountField {
  label: string;
  value: string;
}

export function accountFields(user: AuthUser): AccountField[] {
  return [
    { label: 'Name', value: user.name },
    { label: 'Email', value: user.email },
    { label: 'Role', value: user.role },
    { label: 'User ID', value: user.id },
  ];
}
