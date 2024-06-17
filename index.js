import Queue from 'yocto-queue';

export default function pLimit(concurrency) {
	if (!((Number.isInteger(concurrency) || concurrency === Number.POSITIVE_INFINITY) && concurrency > 0)) {
		throw new TypeError('Expected `concurrency` to be a number from 1 and up');
	}

	const queue = new Queue();
	let activeCount = 0;
	let starter = Promise.resolve();

	const next = () => {
		activeCount--;

		if (queue.size > 0) {
			queue.dequeue()();
		}
	};

	const run = async (function_, resolve, arguments_) => {
		activeCount++;

		const result = (async () => function_(...arguments_))();

		resolve(result);

		try {
			await result;
		} catch {}

		next();
	};

	const enqueue = (function_, resolve, arguments_) => {
		new Promise(r => {
			queue.enqueue(r);
		}).then(
			run.bind(undefined, function_, resolve, arguments_),
		);

		starter = (async () => {
			// This function needs to wait until the next microtask before comparing
			// `activeCount` to `concurrency`, because `activeCount` is updated asynchronously
			// after the r function is dequeued and called. The comparison in the if-statement
			// needs to happen asynchronously as well to get an up-to-date value for `activeCount`.
			await starter;

			if (activeCount < concurrency && queue.size > 0) {
				queue.dequeue()();
			}
		})();
	};

	const generator = (function_, ...arguments_) => new Promise(resolve => {
		enqueue(function_, resolve, arguments_);
	});

	Object.defineProperties(generator, {
		activeCount: {
			get: () => activeCount,
		},
		pendingCount: {
			get: () => queue.size,
		},
		clearQueue: {
			value() {
				queue.clear();
			},
		},
	});

	return generator;
}
