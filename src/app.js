const response = await fetch('./src/app-core.js', { cache: 'no-store' });
if (!response.ok) throw new Error('Unable to load simulator core');
let source = await response.text();
source = source.replace(
  'Object.keys(damageLabels).forEach((part) => {',
  '[' + ['nose', 'hull', 'leftWing', 'rightWing', 'leftEngine', 'rightEngine', 'tail', 'gear'].map((part) => `'${part}'`).join(', ') + '].forEach((part) => {'
);
const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
await import(moduleUrl);
URL.revokeObjectURL(moduleUrl);
