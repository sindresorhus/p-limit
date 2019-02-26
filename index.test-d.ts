import {expectType} from 'tsd-check';
import pLimit from '.';

const limit = pLimit(1);

const input = [
	limit(() => Promise.resolve('foo')),
	limit(() => Promise.resolve('bar')),
	limit(() => Promise.resolve(undefined)),
];

expectType<Promise<Array<string | undefined>>>(Promise.all(input));

expectType<Promise<string>>(limit((a: string) => '', 'test'));
expectType<Promise<string>>(limit((a: string, b: number) => Promise.resolve(''), 'test', 1));

expectType<number>(limit.activeCount);
expectType<number>(limit.pendingCount);
