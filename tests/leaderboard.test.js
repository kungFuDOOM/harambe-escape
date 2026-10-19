import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, getToken } from '../js/leaderboard.js';
test('cleanName accepts normal names and trims', () => { assert.deepEqual(cleanName('  Harambe 22 '), { ok: true, name: 'Harambe 22' }); assert.equal(cleanName('a_b-c.d').ok, true); });
test('cleanName enforces 3-12 chars and charset', () => { for (const n of ['ab', '', 'x'.repeat(13), 'né♥me', '<b>hi</b>']) assert.equal(cleanName(n).ok, false, n); });
test('cleanName blocks profanity incl. leetspeak, not innocent words', () => { for (const n of ['f u c k', 'SH1T', 'b1tch', 'n4zi']) assert.equal(cleanName(n).ok, false, n); for (const n of ['Classic', 'Assassin', 'Harambe']) assert.equal(cleanName(n).ok, true, n); });
test('cleanName blocks phone-like digits and domains', () => { assert.equal(cleanName('5551234567').ok, false); assert.equal(cleanName('joe.com').ok, false); });
test('getToken is stable without storage', () => { const a = getToken(); assert.match(a, /^[0-9a-f]{32}$/); assert.equal(getToken(), a); });
