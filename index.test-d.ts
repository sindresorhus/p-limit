import {expectType} from 'tsd';
import pLimit = require('.');

const limit = pLimit(1);

const input = [
	limit(async () => 'foo'),
	limit(async () => 'bar'),
	limit(async () => undefined)
];

expectType<Promise<Array<string | undefined>>>(Promise.all(input));

expectType<Promise<string>>(limit((a: string) => '', 'test'));
expectType<Promise<string>>(limit(async (a: string, b: number) => '', 'test', 1));

expectType<number>(limit.activeCount);
expectType<number>(limit.pendingCount);

expectType<void>(limit.clearQueue());
