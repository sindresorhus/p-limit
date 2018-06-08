import test from 'ava';
import delay from 'delay';
import inRange from 'in-range';
import timeSpan from 'time-span';
import randomInt from 'random-int';
import m from '.';

test('concurrency: 1', async t => {
	const input = [
		[10, 300],
		[20, 200],
		[30, 100]
	];

	const end = timeSpan();
	const limit = m(1);
	const mapper = ([val, ms]) => limit(() => delay(ms).then(() => val));

	t.deepEqual(await Promise.all(input.map(mapper)), [10, 20, 30]);
	t.true(inRange(end(), 590, 650));
});

test('concurrency: 4', async t => {
	const concurrency = 5;
	let running = 0;

	const limit = m(concurrency);

	const input = Array.from({length: 100}, () => limit(async () => {
		running++;
		t.true(running <= concurrency);
		await delay(randomInt(30, 200));
		running--;
	}));

	await Promise.all(input);
});

test('non-promise returning function', async t => {
	await t.notThrows(async () => {
		const limit = m(1);
		await limit(() => null);
	});
});

test('continues after sync throw', async t => {
	const limit = m(1);
	let ran = false;

	const promises = [
		limit(() => {
			throw new Error('err');
		}),
		limit(() => {
			ran = true;
		})
	];

	await Promise.all(promises).catch(() => {});

	t.is(ran, true);
});

test('can give additional arguments', async t => {
	const limit = m(1);
	const symbol = Symbol('test');

	await limit(a => t.is(a, symbol), symbol);
});
