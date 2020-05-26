'use strict';
const pTry = require('p-try');

const pLimit = concurrency => {
	if (!((Number.isInteger(concurrency) || concurrency === Infinity) && concurrency > 0)) {
		return Promise.reject(new TypeError('Expected `concurrency` to be a number from 1 and up'));
	}

	const queue = [];
	let activeCount = 0;

	const next = () => {
		activeCount--;

		if (queue.length > 0) {
			queue.shift().run();
		}
	};

	const run = (fn, resolve, ...args) => {
		activeCount++;

		const result = pTry(fn, ...args);

		resolve(result);

		result.then(next, next);
	};

	const enqueue = (fn, resolve, reject, ...args) => {
		queue.push({run: run.bind(null, fn, resolve, ...args), reject});

		(async () => {
			// This function needs to wait until the next microtask before comparing
			// `activeCount` to `concurrency`, because `activeCount` is updated asynchronously
			// when the run function is dequeued and called. The comparison in the if-statement
			// needs to happen asynchronously as well to get an up-to-date value for `activeCount`.
			await Promise.resolve();

			if (activeCount < concurrency && queue.length > 0) {
				queue.shift().run();
			}
		})();
	};

	const generator = (fn, ...args) => new Promise(
		(resolve, reject) => enqueue(fn, resolve, reject, ...args)
	);
	Object.defineProperties(generator, {
		activeCount: {
			get: () => activeCount
		},
		pendingCount: {
			get: () => queue.length
		},
		clearQueue: {
			value: () => {
				for (const {reject} of queue) {
					reject(new Error('Queue cleared before function was invoked'));
				}
				queue.length = 0;
			}
		}
	});

	return generator;
};

module.exports = pLimit;
module.exports.default = pLimit;
