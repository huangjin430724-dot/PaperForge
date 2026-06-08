import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { safeJoin, sanitizeUploadPath } from './pathUtils.js';

test('safeJoin allows paths inside the project root', () => {
  const root = path.resolve('tmp-root');
  assert.equal(safeJoin(root, 'paper/main.tex'), path.join(root, 'paper', 'main.tex'));
});

test('safeJoin rejects traversal outside the project root', () => {
  const root = path.resolve('tmp-root');
  assert.throws(() => safeJoin(root, '../outside.tex'), /Invalid path/);
});

test('sanitizeUploadPath normalizes upload filenames', () => {
  assert.equal(sanitizeUploadPath('\\folder/./nested/../main.tex'), 'folder/nested/main.tex');
  assert.equal(sanitizeUploadPath('/safe//figure.png'), 'safe/figure.png');
});
