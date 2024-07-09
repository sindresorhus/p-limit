import Queue from 'yocto-queue';

export default function pLimit(concurrency) {
	validateConcurrency(concurrency);

	const queue = new Queue();
	let activeCount = 0;

	const next = () => {
		if (activeCount < concurrency && queue.size > 0) {
			activeCount++;
			queue.dequeue()();
		}
	};

	const generator = async (function_, ...arguments_) => {
		const dequeuePromise = new Promise(resolve => {
			queue.enqueue(resolve);
		});

		queueMicrotask(next);

		await dequeuePromise;

		try {
			return await function_(...arguments_);
		} finally {
			activeCount--;
			next();
		}
	};

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
		concurrency: {
			get: () => concurrency,

			set(newConcurrency) {
				validateConcurrency(newConcurrency);
				concurrency = newConcurrency;

				queueMicrotask(() => {
					// eslint-disable-next-line no-unmodified-loop-condition
					while (activeCount < concurrency && queue.size > 0) {
						next();
					}
				});
			},
		},
	});

	return generator;
}

function validateConcurrency(concurrency) {
	if (!((Number.isInteger(concurrency) || concurrency === Number.POSITIVE_INFINITY) && concurrency > 0)) {
		throw new TypeError('Expected `concurrency` to be a number from 1 and up');
	}
}
