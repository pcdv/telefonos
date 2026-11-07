import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse, withContact, withoutContact} from '../web/js/contacts.js';

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

test('a contact is removed by its secret', () => {
  assert.deepEqual(withoutContact([{name: 'A', secret: 's1'}, {name: 'B', secret: 's2'}], 's1'), [{name: 'B', secret: 's2'}]);
});
