import test from 'ava';
import delay from 'delay';
import inRange from 'in-range';
import timeSpan from 'time-span';
import randomInt from 'random-int';
import m from './';

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

	const input = Array(100).fill(0).map(() => limit(async () => {
		running++;
		t.true(running <= concurrency);
		await delay(randomInt(30, 200));
		running--;
	}));

	await Promise.all(input);
});
