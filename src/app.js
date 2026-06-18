const sourceUrl = 'https://raw.githubusercontent.com/IFMUN/flightcodex/af5c5a0fec7f25d1c07ab4c5970da2d90cbb3788/src/app.js';
const response = await fetch(sourceUrl, { cache: 'no-store' });
if (!response.ok) throw new Error('Unable to load simulator core');
let source = await response.text();
source = source.replace(
  'Object.keys(damageLabels).forEach((part) => {',
  '[' + ['nose', 'hull', 'leftWing', 'rightWing', 'leftEngine', 'rightEngine', 'tail', 'gear'].map((part) => `'${part}'`).join(', ') + '].forEach((part) => {'
);
const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
await import(moduleUrl);
URL.revokeObjectURL(moduleUrl);
