export function billingEnvironment(): 'test' {
  if (process.env.NEXT_PUBLIC_UPDATE_ENVIRONMENT && process.env.NEXT_PUBLIC_UPDATE_ENVIRONMENT !== 'test') {
    throw new Error('Only Test Mode billing is enabled for this release.');
  }
  return 'test';
}
