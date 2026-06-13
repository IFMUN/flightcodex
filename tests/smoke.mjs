import { readFileSync } from 'node:fs';
const src = readFileSync('src/main.js','utf8');
const html = readFileSync('index.html','utf8');
for (const token of ['Yosemite Falls','B737 MAX 9','heightAt','hurricane','W/S throttle','266k','glass liquid UI']) {
  if (!(src+html).includes(token)) throw new Error(`Missing ${token}`);
}
console.log('smoke ok');
