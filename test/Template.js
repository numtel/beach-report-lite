const assert = require('assert');

const Template = require('../src/Template');

const tplTest = new Template('test/template/test.html');

// No indenting since it would invalidate the expected values
assert.strictEqual(
tplTest.render({ value: '<3', cond: true }),
`Before&lt;3
After
`);

assert.strictEqual(
tplTest.render({ value: '"hey"', cond: false }),
`Before&quot;hey&quot;

`);
