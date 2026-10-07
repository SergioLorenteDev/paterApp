export const DEV_TOKENS: Record<string, { userId: string; role: UserRole; name: string }> = {
  'dev-tecnico': { userId: 'TECH-45', role: 'technician', name: 'Laura Torres' },
  'dev-manager': { userId: 'MGR-12', role: 'manager', name: 'Carlos Ruiz' },
  'dev-comercial': { userId: 'ACC-09', role: 'commercial', name: 'Marta Gil' },
};

export type UserRole = 'technician' | 'manager' | 'commercial';
