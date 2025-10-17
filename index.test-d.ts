import {expectType, expectError} from 'tsd';
import pLimit, {limitFunction} from './index.js';

const limit = pLimit(1);

const input = [
	limit(async () => 'foo'),
	limit(async () => 'bar'),
	limit(async () => undefined),
];

expectType<Promise<Array<string | undefined>>>(Promise.all(input));

expectType<Promise<string>>(limit((_a: string) => '', 'test'));
expectType<Promise<string>>(limit(async (_a: string, _b: number) => '', 'test', 1));

expectType<number>(limit.activeCount);
expectType<number>(limit.pendingCount);

expectType<void>(limit.clearQueue());

// LimitFunction should require a Promise-returning function
const lf = limitFunction(async (_a: string) => 'ok', {concurrency: 1});
expectType<Promise<string>>(lf('input'));

expectError(limitFunction((_a: string) => 'x', {concurrency: 1}));

// LimitFunction.map accepts iterables
expectType<Promise<string[]>>(limit.map(new Set(['a', 'b', 'c']), async x => x + x));
expectType<Promise<number[]>>(limit.map([1, 2, 3].values(), async x => x * 2));
