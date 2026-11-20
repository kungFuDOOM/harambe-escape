import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACT_ADDRESS, CA_TEXT } from '../js/config.js';

test('title contract line reads "CA: coming soon"', () => {
  assert.equal(CONTRACT_ADDRESS, 'coming soon');
  assert.equal(CA_TEXT, 'CA: coming soon');
});
