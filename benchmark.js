import {
	readFile,
	writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout} from 'node:timers/promises';
import crypto from 'node:crypto';
import Benchmarker, {
	randomSleep,
	cpuWork,
	temporaryDirectory,
} from './scripts/benchmarker.js';
import pLimit, {limitFunction} from './index.js';

const benchmarker = new Benchmarker();

benchmarker
	.suite('API Rate Limiting', {description: 'Simulates HTTP requests with different concurrency limits'})
	.scenarios([
		{name: 'Aggressive (concurrency: 1)', concurrency: 1},
		{name: 'Conservative (concurrency: 3)', concurrency: 3},
		{name: 'Moderate (concurrency: 10)', concurrency: 10},
		{name: 'High throughput (concurrency: 50)', concurrency: 50},
	], async ({concurrency}) => {
		const simulateApiCall = async url => {
			// Simulate network latency and processing time
			await randomSleep(50, 80);
			// Simulate JSON parsing and processing
			return {
				url,
				status: 200,
				data: {id: Math.random(), timestamp: Date.now()},
			};
		};

		const urls = Array.from({length: 200}, (_, i) => `https://api.example.com/resource/${i}`);
		const limit = pLimit(concurrency);

		await Promise.all(urls.map(url => limit(() => simulateApiCall(url))));

		return urls.length;
	});

benchmarker
	.suite('File Processing Pipeline', {description: 'Tests concurrent file I/O operations'})
	.scenarios([
		{name: 'Serial processing (concurrency: 1)', concurrency: 1},
		{name: 'Light concurrent (concurrency: 4)', concurrency: 4},
		{name: 'Heavy concurrent (concurrency: 20)', concurrency: 20},
	], async ({concurrency}) => {
		using temporary = temporaryDirectory('p-limit-bench');
		const testDir = temporary.path;
		// Create test files
		const fileData = Array.from({length: 100}, (_, i) => ({
			name: `data-${i}.json`,
			content: JSON.stringify({
				id: i,
				data: crypto.randomBytes(1024).toString('hex'),
				timestamp: Date.now(),
			}),
		}));

		// Write test files
		await Promise.all(fileData.map(file => writeFile(path.join(testDir, file.name), file.content)));

		const processFile = async fileName => {
			const filePath = path.join(testDir, fileName);
			const content = await readFile(filePath, 'utf8');
			const data = JSON.parse(content);
			const processed = {
				...data,
				processed: true,
				hash: crypto.createHash('sha256').update(content).digest('hex'),
				processedAt: Date.now(),
			};
			const outputPath = path.join(testDir, `processed-${fileName}`);
			await writeFile(outputPath, JSON.stringify(processed, null, 2));
			return processed;
		};

		const limit = pLimit(concurrency);
		await Promise.all(fileData.map(file => limit(() => processFile(file.name))));

		return fileData.length;
	});

benchmarker
	.suite('Database Connection Pool', {description: 'Simulates database queries with connection limits'})
	.scenarios([
		{name: 'Single connection (concurrency: 1)', concurrency: 1},
		{name: 'Small pool (concurrency: 5)', concurrency: 5},
		{name: 'Medium pool (concurrency: 15)', concurrency: 15},
		{name: 'Large pool (concurrency: 30)', concurrency: 30},
	], async ({concurrency}) => {
		const simulateDatabaseQuery = async query => {
			// Simulate connection establishment
			await randomSleep(30, 50);

			// Simulate query execution time based on complexity
			const complexity = query.includes('JOIN') ? 100 : (query.includes('SELECT') ? 50 : 30);
			await randomSleep(complexity, complexity + 50);

			return {
				query,
				rows: Math.floor(Math.random() * 1000),
				executionTime: complexity,
			};
		};

		const queries = [
			...Array.from({length: 50}, (_, index) => `SELECT * FROM users WHERE id = ${index}`),
			...Array.from({length: 30}, (_, index) => `SELECT u.*, p.* FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.department = 'dept${index}'`),
			...Array.from({length: 20}, (_, index) => `INSERT INTO logs (user_id, action, timestamp) VALUES (${index}, 'action', NOW())`),
		];

		const limit = pLimit(concurrency);
		await Promise.all(queries.map(query => limit(() => simulateDatabaseQuery(query))));

		return queries.length;
	});

benchmarker
	.suite('Mixed CPU and I/O Workload', {description: 'Tests applications with mixed computational and I/O tasks'})
	.scenarios([
		{name: 'Low concurrency (concurrency: 2)', concurrency: 2},
		{name: 'Medium concurrency (concurrency: 8)', concurrency: 8},
		{name: 'High concurrency (concurrency: 16)', concurrency: 16},
	], async ({concurrency}) => {
		const cpuIntensiveTask = async id => {
			// Simulate CPU-heavy computation
			const hash = cpuWork(1000);
			return {id, hash: hash.slice(0, 16)};
		};

		const ioIntensiveTask = async id => {
			// Simulate multiple I/O operations
			await randomSleep(20, 60); // Network request
			await randomSleep(15, 40); // Database query
			await randomSleep(10, 30); // File system operation
			return {id, timestamp: Date.now()};
		};

		const mixedTask = async id => {
			const [cpuResult, ioResult] = await Promise.all([
				cpuIntensiveTask(id),
				ioIntensiveTask(id),
			]);
			return {id, cpu: cpuResult, io: ioResult};
		};

		const taskCount = 80;
		const limit = pLimit(concurrency);
		await Promise.all(Array.from({length: taskCount}, (_, id) => limit(() => mixedTask(id))));

		return taskCount;
	});

benchmarker
	.suite('High-Volume Queue Performance', {description: 'Tests performance under heavy load with many queued operations'})
	.scenarios([
		{name: '500 tasks, concurrency: 5', tasks: 500, concurrency: 5},
		{name: '1000 tasks, concurrency: 10', tasks: 1000, concurrency: 10},
		{name: '2000 tasks, concurrency: 20', tasks: 2000, concurrency: 20},
		{name: '5000 tasks, concurrency: 50', tasks: 5000, concurrency: 50},
	], async ({tasks, concurrency}) => {
		const simpleTask = async id => {
			// Lightweight task with some async work
			await randomSleep(5, 15);
			return id * 2;
		};

		const limit = pLimit(concurrency);
		await Promise.all(Array.from({length: tasks}, (_, id) => limit(() => simpleTask(id))));

		return tasks;
	});

benchmarker
	.suite('limitFunction() Performance', {description: 'Compares limitFunction vs regular pLimit approach'})
	.scenarios([
		{name: 'Regular pLimit approach', useLimitFunction: false, concurrency: 10},
		{name: 'limitFunction approach', useLimitFunction: true, concurrency: 10},
	], async ({useLimitFunction, concurrency}) => {
		const taskWithDelay = async (delay, value) => {
			await setTimeout(delay);
			return value * 3;
		};

		const taskCount = 200;
		const delays = Array.from({length: taskCount}, () => Math.random() * 20);

		if (useLimitFunction) {
			const limitedTask = limitFunction(taskWithDelay, {concurrency});
			await Promise.all(delays.map((delay, i) => limitedTask(delay, i)));
		} else {
			const limit = pLimit(concurrency);
			await Promise.all(delays.map((delay, i) => limit(() => taskWithDelay(delay, i))));
		}

		return taskCount;
	});

benchmarker
	.suite('Dynamic Concurrency Adjustment', {description: 'Tests adjusting concurrency limits during execution'})
	.scenario('Dynamic adjustment test', async () => {
		const adaptiveTask = async id => {
			await randomSleep(10, 60);
			return {id, processingTime: (Math.random() * 50) + 10};
		};

		const taskCount = 300;
		const limit = pLimit(5);

		// Start tasks
		const tasks = Array.from({length: taskCount}, (_, id) => limit(() => adaptiveTask(id)));

		// Adjust concurrency during execution
		setTimeout(() => {
			limit.concurrency = 15; // Increase concurrency
		}, 1000);

		setTimeout(() => {
			limit.concurrency = 8; // Decrease concurrency
		}, 2000);

		await Promise.all(tasks);

		return taskCount;
	});

// Run all benchmarks
await benchmarker.run({
	title: 'p-limit Real-World Benchmarks',
});
