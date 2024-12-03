import {AsyncLocalStorage} from 'node:async_hooks';
import test from 'ava';
import delay from 'delay';
import inRange from 'in-range';
import timeSpan from 'time-span';
import randomInt from 'random-int';
import pLimit, {limitFunction} from './index.js';

test('concurrency: 1', async t => {
	const input = [
		[10, 300],
		[20, 200],
		[30, 100],
	];

	const end = timeSpan();
	const limit = pLimit(1);

	const mapper = ([value, ms]) => limit(async () => {
		await delay(ms);
		return value;
	});

	t.deepEqual(await Promise.all(input.map(x => mapper(x))), [10, 20, 30]);
	t.true(inRange(end(), {start: 590, end: 650}));
});

test('concurrency: 4', async t => {
	const concurrency = 5;
	let running = 0;

	const limit = pLimit(concurrency);

	const input = Array.from({length: 100}, () => limit(async () => {
		running++;
		t.true(running <= concurrency);
		await delay(randomInt(30, 200));
		running--;
	}));

	await Promise.all(input);
});

test('propagates async execution context properly', async t => {
	const concurrency = 2;
	const limit = pLimit(concurrency);
	const store = new AsyncLocalStorage();

	const checkId = async id => {
		await Promise.resolve();
		t.is(id, store.getStore()?.id);
	};

	const startContext = async id => store.run({id}, () => limit(checkId, id));

	await Promise.all(
		Array.from({length: 100}, (_, id) => startContext(id)),
	);
});

test('non-promise returning function', async t => {
	await t.notThrowsAsync(async () => {
		const limit = pLimit(1);
		await limit(() => null);
	});
});

test('continues after sync throw', async t => {
	const limit = pLimit(1);
	let ran = false;

	const promises = [
		limit(() => {
			throw new Error('err');
		}),
		limit(() => {
			ran = true;
		}),
	];

	await Promise.all(promises).catch(() => {});

	t.is(ran, true);
});

test('accepts additional arguments', async t => {
	const limit = pLimit(1);
	const symbol = Symbol('test');

	await limit(a => t.is(a, symbol), symbol);
});

test('does not ignore errors', async t => {
	const limit = pLimit(1);
	const error = new Error('🦄');

	const promises = [
		limit(async () => {
			await delay(30);
		}),
		limit(async () => {
			await delay(80);
			throw error;
		}),
		limit(async () => {
			await delay(50);
		}),
	];

	await t.throwsAsync(Promise.all(promises), {is: error});
});

test('activeCount and pendingCount properties', async t => {
	const limit = pLimit(5);
	t.is(limit.activeCount, 0);
	t.is(limit.pendingCount, 0);

	const runningPromise1 = limit(() => delay(1000));
	t.is(limit.activeCount, 0);
	t.is(limit.pendingCount, 1);

	await Promise.resolve();
	t.is(limit.activeCount, 1);
	t.is(limit.pendingCount, 0);

	await runningPromise1;
	t.is(limit.activeCount, 0);
	t.is(limit.pendingCount, 0);

	const immediatePromises = Array.from({length: 5}, () => limit(() => delay(1000)));
	const delayedPromises = Array.from({length: 3}, () => limit(() => delay(1000)));

	await Promise.resolve();
	t.is(limit.activeCount, 5);
	t.is(limit.pendingCount, 3);

	await Promise.all(immediatePromises);
	t.is(limit.activeCount, 3);
	t.is(limit.pendingCount, 0);

	await Promise.all(delayedPromises);

	t.is(limit.activeCount, 0);
	t.is(limit.pendingCount, 0);
});

test('clearQueue', async t => {
	const limit = pLimit(1);

	Array.from({length: 1}, () => limit(() => delay(1000)));
	Array.from({length: 3}, () => limit(() => delay(1000)));

	await Promise.resolve();
	t.is(limit.pendingCount, 3);
	limit.clearQueue();
	t.is(limit.pendingCount, 0);
});

test('throws on invalid concurrency argument', t => {
	t.throws(() => {
		pLimit(0);
	});

	t.throws(() => {
		pLimit(-1);
	});

	t.throws(() => {
		pLimit(1.2);
	});

	t.throws(() => {
		pLimit(undefined);
	});

	t.throws(() => {
		pLimit(true);
	});
});

test('change concurrency to smaller value', async t => {
	const limit = pLimit(4);
	let running = 0;
	const log = [];
	const promises = Array.from({length: 10}).map(() =>
		limit(async () => {
			++running;
			log.push(running);
			await delay(50);
			--running;
		}),
	);
	await delay(0);
	t.is(running, 4);

	limit.concurrency = 2;
	await Promise.all(promises);
	t.deepEqual(log, [1, 2, 3, 4, 2, 2, 2, 2, 2, 2]);
});

test('change concurrency to bigger value', async t => {
	const limit = pLimit(2);
	let running = 0;
	const log = [];
	const promises = Array.from({length: 10}).map(() =>
		limit(async () => {
			++running;
			log.push(running);
			await delay(50);
			--running;
		}),
	);
	await delay(0);
	t.is(running, 2);

	limit.concurrency = 4;
	await Promise.all(promises);
	t.deepEqual(log, [1, 2, 3, 4, 4, 4, 4, 4, 4, 4]);
});

test('limit function with concurrency', async t => {
	const concurrency = 5;
	let running = 0;

	const limitFunction_ = limitFunction(async () => {
		running++;
		t.true(running <= concurrency);
		await delay(randomInt(30, 200));
		running--;
	}, {concurrency});

	const input = Array.from({length: 100}, limitFunction_);

	await Promise.all(input);
});
