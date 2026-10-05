export type ProviderHealthPayload = {
  status?: unknown;
  ready?: unknown;
  database?: unknown;
  schemaConfigured?: unknown;
  inventoryConstraintConfigured?: unknown;
  dataInvariantsConfigured?: unknown;
  catalogueQueryIndexConfigured?: unknown;
  emailProcessingStateConfigured?: unknown;
  deploymentConfigured?: unknown;
  paymentsConfigured?: unknown;
  authConfigured?: unknown;
  storageConfigured?: unknown;
  emailConfigured?: unknown;
  supportConfigured?: unknown;
  cronConfigured?: unknown;
};

export function healthUrlFromBase(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Health URL must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('Health URL must not contain embedded credentials');
  }

  url.pathname = '/api/health';
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function isReadyHealthPayload(
  payload: unknown,
): payload is ProviderHealthPayload {
  if (!payload || typeof payload !== 'object') return false;
  const health = payload as ProviderHealthPayload;
  return health.ready === true && health.status === 'ok';
}

export function healthChecks(payload: ProviderHealthPayload) {
  return [
    ['database', payload.database],
    ['schema', payload.schemaConfigured],
    ['inventory constraint', payload.inventoryConstraintConfigured],
    ['data invariants', payload.dataInvariantsConfigured],
    ['catalogue query index', payload.catalogueQueryIndexConfigured],
    ['email processing state', payload.emailProcessingStateConfigured],
    ['deployment', payload.deploymentConfigured],
    ['payments', payload.paymentsConfigured],
    ['auth', payload.authConfigured],
    ['storage', payload.storageConfigured],
    ['email', payload.emailConfigured],
    ['support', payload.supportConfigured],
    ['cron', payload.cronConfigured],
  ] as const;
}
