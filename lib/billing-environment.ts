export function billingEnvironment(): 'test' {
  if (process.env.STRIPE_MODE && process.env.STRIPE_MODE !== 'test') {
    throw new Error('Only Test Mode billing is enabled for this release.');
  }
  return 'test';
}
