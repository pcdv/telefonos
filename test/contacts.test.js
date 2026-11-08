import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse, withContact, withoutContact, withSecret} from '../web/js/contacts.js';

test('what is stored is read back, and nothing else', () => {
  assert.deepEqual(parse(null), []);
  assert.deepEqual(parse('not json'), []);
  assert.deepEqual(parse('{"a": 1}'), []);
  assert.deepEqual(parse('[{"name": "A", "secret": "s", "extra": 1}, {"name": 3}, null]'), [{name: 'A', secret: 's'}]);
});

test('the same secret pairs once: a second one renames', () => {
  const list = withContact([{name: 'A', secret: 's1'}], {name: 'B', secret: 's2'});
  assert.equal(list.length, 2);
  assert.deepEqual(withContact(list, {name: 'A2', secret: 's1'}), [{name: 'A2', secret: 's1'}, {name: 'B', secret: 's2'}]);
});

test('the admin key and the epoch are kept, and only when they make sense', () => {
  assert.deepEqual(
    parse('[{"name": "A", "secret": "s", "admin": "K", "epoch": 2}, {"name": "B", "secret": "t", "admin": 1, "epoch": -1}, {"name": "C", "secret": "u", "epoch": 1.5}]'),
    [{name: 'A', secret: 's', admin: 'K', epoch: 2}, {name: 'B', secret: 't'}, {name: 'C', secret: 'u'}]);
});

test('a change of secret keeps the contact, its name and its admin', () => {
  const list = [{name: 'A', secret: 's1', admin: 'K'}, {name: 'B', secret: 's2'}];
  assert.deepEqual(withSecret(list, 's1', 's3', 1), [{name: 'A', secret: 's3', admin: 'K', epoch: 1}, {name: 'B', secret: 's2'}]);
  assert.deepEqual(withSecret(list, 'nobody', 's3', 1), list);
});

test('a contact is removed by its secret', () => {
  assert.deepEqual(withoutContact([{name: 'A', secret: 's1'}, {name: 'B', secret: 's2'}], 's1'), [{name: 'B', secret: 's2'}]);
});
