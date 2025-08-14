#!/usr/bin/env node

// TODO: I will move this to a proper package at some point.

import {performance} from 'node:perf_hooks';
import crypto from 'node:crypto';
import {styleText} from 'node:util';
import {tmpdir} from 'node:os';
import fs from 'node:fs';
import nodePath from 'node:path';
import {setTimeout} from 'node:timers/promises';

class Benchmarker {
	#suites = [];
	#totalStart = 0;

	constructor() {
		this.formatDuration = ms => {
			if (ms < 1000) {
				return `${Math.round(ms)}ms`;
			}

			return `${(ms / 1000).toFixed(2)}s`;
		};

		this.formatThroughput = (operationCount, timeMs) => {
			const operationsPerSecond = (operationCount / timeMs) * 1000;
			return `${Math.round(operationsPerSecond)} ops/s`;
		};
	}

	/**
	Create a new benchmark suite.

	@param {string} name - The name of the benchmark suite.
	@param {object} options - Configuration options.
	@param {string} [options.description] - Description of what this suite tests.
	@returns {BenchmarkSuite} A new benchmark suite instance.
	*/
	suite(name, options = {}) {
		const suite = new BenchmarkSuite(name, options, this);
		this.#suites.push(suite);
		return suite;
	}

	/**
	Run all benchmark suites.

	@param {object} options - Options for running benchmarks.
	@param {boolean} [options.showNotes=true] - Whether to show helpful notes at the end.
	@param {string} [options.title] - Custom title for the benchmark run.
	@returns {Promise<void>}
	*/
	async run(options = {}) {
		const {
			showNotes = false,
			title = 'Benchmarks',
		} = options;

		console.log(styleText('bold', title));
		console.log();
		this.#totalStart = performance.now();

		for (const suite of this.#suites) {
			// eslint-disable-next-line no-await-in-loop
			await suite.run();
		}

		const totalDuration = performance.now() - this.#totalStart;
		console.log(styleText('green', `Completed in ${this.formatDuration(totalDuration)}`));

		if (showNotes) {
			console.log();
			console.log(styleText('gray', 'Notes: These benchmarks reflect real workloads and may vary with system load.'));
		}
	}
}

class BenchmarkSuite {
	#name;
	#options;
	#benchmarker;
	#scenarios = [];

	constructor(name, options, benchmarker) {
		this.#name = name;
		this.#options = options;
		this.#benchmarker = benchmarker;
	}

	/**
	Add a scenario to this benchmark suite.

	@param {string} name - The name of the scenario.
	@param {Function} fn - The function to benchmark. Can be async.
	@param {object} [options] - Scenario options.
	@param {number} [options.iterations=1] - Number of times to run this scenario.
	@param {boolean} [options.warmup=false] - Whether to run a warmup iteration.
	@returns {BenchmarkSuite} This suite for chaining.
	*/
	scenario(name, fn, options = {}) {
		this.#scenarios.push({
			name,
			fn,
			options: {
				iterations: 1,
				warmup: false,
				...options,
			},
		});
		return this;
	}

	/**
	Add multiple scenarios with different configurations.

	@param {Array<{name: string, config: object}>} configs - Array of scenario configurations.
	@param {Function} fn - The function to benchmark, receives config as parameter.
	@param {object} [options] - Shared options for all scenarios.
	@returns {BenchmarkSuite} This suite for chaining.
	*/
	scenarios(configs, fn, options = {}) {
		for (const config of configs) {
			this.scenario(config.name, () => fn(config.config || config), options);
		}

		return this;
	}

	/**
	Run this benchmark suite.

	@returns {Promise<void>}
	*/
	async run() {
		const description = this.#options.description || '';
		const headerName = styleText('bold', styleText('cyan', this.#name));
		const header = `${headerName}${description ? ` ${styleText('gray', `— ${description}`)}` : ''}`;
		console.log(header);

		for (const scenario of this.#scenarios) {
			// eslint-disable-next-line no-await-in-loop
			await this.#runScenario(scenario);
		}

		console.log();
	}

	async #runScenario(scenario) {
		const {name, fn, options} = scenario;

		// Warmup run
		if (options.warmup) {
			try {
				await fn();
			} catch {
				// Ignore warmup errors
			}
		}

		// Actual benchmark runs
		const times = [];
		let lastResult;
		for (let index = 0; index < options.iterations; index++) {
			const start = performance.now();
			// eslint-disable-next-line no-await-in-loop
			lastResult = await fn();
			times.push(performance.now() - start);
		}

		// Calculate statistics
		let _total = 0;
		for (const time of times) {
			_total += time;
		}

		const averageTime = _total / times.length;

		const result = options.iterations === 1
			? this.#benchmarker.formatDuration(averageTime)
			: `${this.#benchmarker.formatDuration(averageTime)} average (${options.iterations} runs)`;

		let extra = '';
		const operationCount = typeof lastResult === 'number' ? lastResult : undefined;
		if (Number.isFinite(operationCount) && operationCount > 0) {
			const operationsPerSecond = this.#benchmarker.formatThroughput(operationCount, averageTime);
			extra = styleText('gray', `(${operationsPerSecond})`);
		}

		const columns = [name, styleText('green', result)];
		if (extra) {
			columns.push(extra);
		}

		console.log(`\t${columns.join('\t')}`);
	}
}

/**
Helper function to create random delays.

@param {number} min - Minimum delay in ms.
@param {number} max - Maximum delay in ms.
@returns {Promise<void>}
*/
export const randomSleep = (min, max) => setTimeout(min + (Math.random() * (max - min)));

/**
Helper function to simulate CPU-intensive work.

@param {number} [iterations=1000] - Number of hash iterations to perform.
@returns {string} Generated hash.
*/
export const cpuWork = (iterations = 1000) => {
	// Node.js implementation using synchronous hashing to simulate CPU work
	let hash = crypto.randomBytes(32).toString('hex');
	for (let index = 0; index < iterations; index++) {
		hash = crypto.createHash('sha256').update(hash).digest('hex');
	}

	return hash;
};

/**
Async resource for a temporary directory.

Create a disposable temporary directory for use with `using`.

Accepts a human-friendly `name` that becomes the directory prefix.
*/
export function temporaryDirectory(name) {
	const base = nodePath.join(tmpdir(), `${name}-`);
	return fs.mkdtempDisposableSync(base);
}

export default Benchmarker;
