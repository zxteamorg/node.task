import { CancellationToken } from "@zxteam/contract";
import { ManualCancellationTokenSource } from "@zxteam/cancellation";
import { AggregateError } from "@zxteam/errors";

import { assert } from "chai";

import { Task } from "../src/index";

describe("Regression", function () {
	describe("0.0.1", function () {
		it("Should cancel two listeners", async function () {
			let cancel1 = false;
			let cancel2 = false;

			const cts = new ManualCancellationTokenSource();

			const defer: any = {};
			defer.promise = new Promise(resolve => { defer.resolve = resolve; });

			const task = Task.create(
				async (ct: CancellationToken): Promise<void> => {

					const cb1 = () => {
						cancel1 = true;
						ct.removeCancelListener(cb1);
					};
					ct.addCancelListener(cb1);

					const cb2 = () => {
						cancel2 = true;
						ct.removeCancelListener(cb2);
					};
					ct.addCancelListener(cb2);
					await defer.promise;
				},
				cts.token
			).start();

			await Task.sleep(5);

			assert.isFalse(cancel1);
			assert.isFalse(cancel2);

			cts.cancel();

			assert.isTrue(cancel1);
			assert.isTrue(cancel2, "Should call Cancel Callback 2"); // version 0.0.1 did not call cb2

			defer.resolve();
			await Task.sleep(5);

			assert.isTrue(cancel1);
			assert.isTrue(cancel2);
		});
	});

	describe("3.2.4", function () {
		it("Should not produce unhandledRejection", async () => {
			class TestError extends Error { }

			let unhandledRejectionCount = 0;
			function unhandledRejectionHandler() {
				++unhandledRejectionCount;
			}
			process.on("unhandledRejection", unhandledRejectionHandler);
			try {
				const taskRoot = Task.run(() => { throw new TestError("Fake Error"); });

				let fails = 0;

				taskRoot.promise
					.then(() => {
						// NOPE: this nope is reason for unhandledRejection in 3.2.4
					})
					.catch(() => { ++fails; });

				let expectedError;
				try {
					await Task.waitAll(taskRoot);
				} catch (e) {
					expectedError = e;
				}

				await Task.sleep(250);

				assert.isTrue(taskRoot.isCompleted);
				assert.isFalse(taskRoot.isCancelled);
				assert.isTrue(taskRoot.isFaulted);
				assert.isDefined(expectedError);
				assert.instanceOf(expectedError, AggregateError);
				assert.instanceOf((expectedError as AggregateError).innerError, TestError);
				assert.isNotNull((expectedError as AggregateError).innerError, "Fake Error");
				assert.equal(((expectedError as AggregateError).innerError as Error).message, "Fake Error");

				assert.equal(fails, 1);
				assert.equal(unhandledRejectionCount, 0, "Should no unhandledRejection(s)");
			} finally {
				process.removeListener("unhandledRejection", unhandledRejectionHandler);
			}
		});

		// it("Should not produce unhandledRejection", async () => {
		// 	class TestError extends Error { }

		// 	let unhandledRejectionCount = 0;
		// 	function unhandledRejectionHandler() {
		// 		++unhandledRejectionCount;
		// 	}
		// 	process.on("unhandledRejection", unhandledRejectionHandler);
		// 	try {
		// 		//const task1 = Task.create<number>(() => Promise.reject(new TestError("Fake Error")));
		// 		const task = Task
		// 			.create(() => { throw new TestError("Fake Error"); })
		// 			.promise.catch(() => {
		// 				// NOPE
		// 				// this nope is reason for unhandledRejection in 3.2.4
		// 			});

		// 		let expectedError;
		// 		try {
		// 			await Task.waitAll(task);
		// 		} catch (e) {
		// 			expectedError = e;
		// 		}

		// 		await Task.sleep(25);

		// 		assert.isTrue(task.isCompleted);
		// 		assert.isFalse(task.isCancelled);
		// 		assert.isTrue(task.isFaulted);
		// 		assert.isDefined(expectedError);
		// 		assert.instanceOf(expectedError, AggregateError);
		// 		assert.instanceOf((expectedError as AggregateError).innerError, TestError);
		// 		assert.equal((expectedError as AggregateError).innerError.message, "Fake Error");

		// 		assert.equal(unhandledRejectionCount, 0, "Should no unhandledRejection(s)");
		// 	} finally {
		// 		process.removeListener("unhandledRejection", unhandledRejectionHandler);
		// 	}
		// });
	});

	describe("4.0.0", function () {
		it("continuation task should start when parent task is completed", async function () {
			const autoRejectDefer: any = {};
			autoRejectDefer.promise = new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("continue callback was not called, but have to"));
				}, 1000); // auto reject in 1 seconds
				function resolveWrapper() {
					resolve();
					clearTimeout(timeout);
				}
				function rejectWrapper(reason: any) {
					reject(reason);
					clearTimeout(timeout);
				}
				autoRejectDefer.resolve = resolveWrapper;
				autoRejectDefer.reject = rejectWrapper;
				autoRejectDefer.timeout = setTimeout(reject, 1000); // auto reject in 1 seconds
			});

			Task.resolve(42).continue(() => {
				autoRejectDefer.resolve();
			});

			await autoRejectDefer.promise;
		});
		it("continuation task should start if parent task is finished", async function () {
			const autoRejectDefer: any = {};
			autoRejectDefer.promise = new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error("continue callback was not called, but have to"));
				}, 1000); // auto reject in 1 seconds
				function resolveWrapper() {
					resolve();
					clearTimeout(timeout);
				}
				function rejectWrapper(reason: any) {
					reject(reason);
					clearTimeout(timeout);
				}
				autoRejectDefer.resolve = resolveWrapper;
				autoRejectDefer.reject = rejectWrapper;
				autoRejectDefer.timeout = setTimeout(reject, 1000); // auto reject in 1 seconds
			});

			const task = Task.resolve(Promise.resolve(42));
			await task.wait(); // force to complete first task

			task.continue(() => { autoRejectDefer.resolve(); });

			await autoRejectDefer.promise;
		});
	});
});
