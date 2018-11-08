import { assert } from "chai";

import { Task, AggregateError, CancelledError, WrapError } from "../src/index";

describe("Generic tests", () => {
	it("Should wait for synchronous task", async () => {
		const task1 = new Task<number>(() => 42);

		await task1.wait();

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should wait for asynchronous task", async () => {
		const task1 = new Task<number>(() => Promise.resolve(42));

		await task1.wait();

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should wait for Promise task", async () => {
		const task1 = new Task<number>(Promise.resolve(42));

		await task1.wait();

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should waitAll for synchronous task", async () => {
		const task1 = new Task<number>(() => 42);

		await Task.waitAll(task1);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should waitAll for asynchronous task", async () => {
		const task1 = new Task<number>(() => Promise.resolve(42));

		await Task.waitAll(task1);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should waitAll for synchronous tasks", async () => {
		const task1 = new Task<number>(() => 42);
		const task2 = new Task<string>(() => "42");
		const task3 = new Task<boolean>(() => true);

		await Task.waitAll(task1, task2);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.isTrue(task2.isCompleted);
		assert.isFalse(task2.isCancelled);
		assert.isFalse(task2.isFaulted);
		assert.isTrue(task3.isCompleted);
		assert.isFalse(task3.isCancelled);
		assert.isFalse(task3.isFaulted);

		assert.equal(task1.result, 42);
		assert.equal(task2.result, "42");
		assert.equal(task3.result, true);
	});
	it("Should waitAll for asynchronous tasks", async () => {
		const task1 = new Task<number>(() => Promise.resolve(42));
		const task2 = new Task<string>(() => Promise.resolve("42"));
		const task3 = new Task<boolean>(() => Promise.resolve(true));

		await Task.waitAll(task1, task2);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.isTrue(task2.isCompleted);
		assert.isFalse(task2.isCancelled);
		assert.isFalse(task2.isFaulted);
		assert.isTrue(task3.isCompleted);
		assert.isFalse(task3.isCancelled);
		assert.isFalse(task3.isFaulted);

		assert.equal(task1.result, 42);
		assert.equal(task2.result, "42");
		assert.equal(task3.result, true);
	});
	it("Should waitAll for mixed (synchronous/asynchronous) tasks", async () => {
		const task1 = new Task<number>(() => Promise.resolve(42));
		const task2 = new Task<string>(() => "42");
		const task3 = new Task<boolean>(() => Promise.resolve(true));

		await Task.waitAll(task1, task2);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.isTrue(task2.isCompleted);
		assert.isFalse(task2.isCancelled);
		assert.isFalse(task2.isFaulted);
		assert.isTrue(task3.isCompleted);
		assert.isFalse(task3.isCancelled);
		assert.isFalse(task3.isFaulted);

		assert.equal(task1.result, 42);
		assert.equal(task2.result, "42");
		assert.equal(task3.result, true);
	});
	it("Should handle error fail for synchronous task", async () => {
		class TestError extends Error { }

		const task1 = new Task<number>(() => { throw new TestError("Fake Error"); });

		let expectedError;
		try {
			await task1.wait();
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);
		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, TestError);
		assert.equal(expectedError.message, "Fake Error");
	});
	it("Should handle error fail for asynchronous task", async () => {
		class TestError extends Error { }

		const task1 = new Task<number>(() => Promise.reject(new TestError("Fake Error")));

		let expectedError;
		try {
			await task1.wait();
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);
		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, TestError);
		assert.equal(expectedError.message, "Fake Error");
	});
	it("Should handle error fail for asynchronous task via waitAll", async () => {
		class TestError extends Error { }

		const task1 = new Task<number>(() => Promise.reject(new TestError("Fake Error")));

		let expectedError;
		try {
			await Task.waitAll(task1);
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);
		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, TestError);
		assert.equal(expectedError.message, "Fake Error");
	});
	it("Should handle non-error fail for synchronous task", async () => {
		const task1 = new Task<number>(() => { throw "Fake Error"; });

		let expectedError;
		try {
			await task1.wait();
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);
		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, WrapError);
		assert.equal(expectedError.wrap, "Fake Error");
	});
	it("Should handle non-error fail for asynchronous task", async () => {
		const task1 = new Task<number>(() => Promise.reject("Fake Error"));

		let expectedError;
		try {
			await task1.wait();
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);
		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, WrapError);
		assert.equal(expectedError.wrap, "Fake Error");
	});
	it("Should handle all fails for synchronous tasks", async () => {
		class TestError1 extends Error { }
		class TestError2 extends Error { }
		class TestError3 extends Error { }

		const task1 = new Task<number>(() => { throw new TestError1("Fake Error 1"); });
		const task2 = new Task<string>(() => { throw new TestError2("Fake Error 2"); });
		const task3 = new Task<boolean>(() => { throw new TestError3("Fake Error 3"); });

		let expectedError;
		try {
			await Task.waitAll(task1, task2, task3);
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);
		assert.isTrue(task2.isCompleted);
		assert.isFalse(task2.isCancelled);
		assert.isTrue(task2.isFaulted);
		assert.isTrue(task3.isCompleted);
		assert.isFalse(task3.isCancelled);
		assert.isTrue(task3.isFaulted);

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, AggregateError);
		assert.equal(expectedError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerError);
		assert.instanceOf(expectedError.innerError, TestError1);
		assert.equal(expectedError.innerError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerErrors);
		assert.isArray(expectedError.innerErrors);
		assert.equal(expectedError.innerErrors.length, 3);
		assert.instanceOf(expectedError.innerErrors[0], TestError1);
		assert.equal(expectedError.innerErrors[0].message, "Fake Error 1");
		assert.instanceOf(expectedError.innerErrors[1], TestError2);
		assert.equal(expectedError.innerErrors[1].message, "Fake Error 2");
		assert.instanceOf(expectedError.innerErrors[2], TestError3);
		assert.equal(expectedError.innerErrors[2].message, "Fake Error 3");
	});
	it("Should handle all fails for asynchronous tasks", async () => {
		class TestError1 extends Error { }
		class TestError2 extends Error { }
		class TestError3 extends Error { }

		const task1 = new Task<number>(() => Promise.reject(new TestError1("Fake Error 1")));
		const task2 = new Task<string>(() => Promise.reject(new TestError2("Fake Error 2")));
		const task3 = new Task<boolean>(() => Promise.reject(new TestError3("Fake Error 3")));

		let expectedError;
		try {
			await Task.waitAll(task1, task2, task3);
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);
		assert.isTrue(task2.isCompleted);
		assert.isFalse(task2.isCancelled);
		assert.isTrue(task2.isFaulted);
		assert.isTrue(task3.isCompleted);
		assert.isFalse(task3.isCancelled);
		assert.isTrue(task3.isFaulted);

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, AggregateError);
		assert.equal(expectedError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerError);
		assert.instanceOf(expectedError.innerError, TestError1);
		assert.equal(expectedError.innerError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerErrors);
		assert.isArray(expectedError.innerErrors);
		assert.equal(expectedError.innerErrors.length, 3);
		assert.instanceOf(expectedError.innerErrors[0], TestError1);
		assert.equal(expectedError.innerErrors[0].message, "Fake Error 1");
		assert.instanceOf(expectedError.innerErrors[1], TestError2);
		assert.equal(expectedError.innerErrors[1].message, "Fake Error 2");
		assert.instanceOf(expectedError.innerErrors[2], TestError3);
		assert.equal(expectedError.innerErrors[2].message, "Fake Error 3");
	});
	it("Should handle all fails for mixed (synchronous/asynchronous) tasks", async () => {
		class TestError1 extends Error { }
		class TestError2 extends Error { }
		class TestError3 extends Error { }

		const task1 = new Task<number>(() => Promise.reject(new TestError1("Fake Error 1")));
		const task2 = new Task<string>(() => { throw new TestError2("Fake Error 2"); });
		const task3 = new Task<boolean>(() => Promise.reject(new TestError3("Fake Error 3")));

		let expectedError;
		try {
			await Task.waitAll(task1, task2, task3);
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);
		assert.isTrue(task2.isCompleted);
		assert.isFalse(task2.isCancelled);
		assert.isTrue(task2.isFaulted);
		assert.isTrue(task3.isCompleted);
		assert.isFalse(task3.isCancelled);
		assert.isTrue(task3.isFaulted);

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, AggregateError);
		assert.equal(expectedError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerError);
		assert.instanceOf(expectedError.innerError, TestError1);
		assert.equal(expectedError.innerError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerErrors);
		assert.isArray(expectedError.innerErrors);
		assert.equal(expectedError.innerErrors.length, 3);
		assert.instanceOf(expectedError.innerErrors[0], TestError1);
		assert.equal(expectedError.innerErrors[0].message, "Fake Error 1");
		assert.instanceOf(expectedError.innerErrors[1], TestError2);
		assert.equal(expectedError.innerErrors[1].message, "Fake Error 2");
		assert.instanceOf(expectedError.innerErrors[2], TestError3);
		assert.equal(expectedError.innerErrors[2].message, "Fake Error 3");
	});
	it("Should handle partial fails for synchronous tasks", async () => {
		class TestError1 extends Error { }
		class TestError3 extends Error { }

		const task1 = new Task<number>(() => { throw new TestError1("Fake Error 1"); });
		const task2 = new Task<string>(() => "42");
		const task3 = new Task<boolean>(() => { throw new TestError3("Fake Error 3"); });

		let expectedError;
		try {
			await Task.waitAll(task1, task2, task3);
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);

		assert.isTrue(task2.isCompleted);
		assert.isFalse(task2.isCancelled);
		assert.isFalse(task2.isFaulted);

		assert.isTrue(task3.isCompleted);
		assert.isFalse(task3.isCancelled);
		assert.isTrue(task3.isFaulted);

		assert.equal(task2.result, "42");

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, AggregateError);
		assert.equal(expectedError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerError);
		assert.instanceOf(expectedError.innerError, TestError1);
		assert.equal(expectedError.innerError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerErrors);
		assert.isArray(expectedError.innerErrors);
		assert.equal(expectedError.innerErrors.length, 2);
		assert.instanceOf(expectedError.innerErrors[0], TestError1);
		assert.equal(expectedError.innerErrors[0].message, "Fake Error 1");
		assert.instanceOf(expectedError.innerErrors[1], TestError3);
		assert.equal(expectedError.innerErrors[1].message, "Fake Error 3");
	});
	it("Should handle partial fails for asynchronous tasks", async () => {
		class TestError1 extends Error { }
		class TestError3 extends Error { }

		const task1 = new Task<number>(() => Promise.reject(new TestError1("Fake Error 1")));
		const task2 = new Task<string>(() => Promise.resolve("42"));
		const task3 = new Task<boolean>(() => Promise.reject(new TestError3("Fake Error 3")));

		let expectedError;
		try {
			await Task.waitAll(task1, task2, task3);
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);

		assert.isTrue(task2.isCompleted);
		assert.isFalse(task2.isCancelled);
		assert.isFalse(task2.isFaulted);

		assert.isTrue(task3.isCompleted);
		assert.isFalse(task3.isCancelled);
		assert.isTrue(task3.isFaulted);

		assert.equal(task2.result, "42");

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, AggregateError);
		assert.equal(expectedError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerError);
		assert.instanceOf(expectedError.innerError, TestError1);
		assert.equal(expectedError.innerError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerErrors);
		assert.isArray(expectedError.innerErrors);
		assert.equal(expectedError.innerErrors.length, 2);
		assert.instanceOf(expectedError.innerErrors[0], TestError1);
		assert.equal(expectedError.innerErrors[0].message, "Fake Error 1");
		assert.instanceOf(expectedError.innerErrors[1], TestError3);
		assert.equal(expectedError.innerErrors[1].message, "Fake Error 3");
	});
	it("Should handle partial fails for mixed (synchronous/asynchronous) tasks", async () => {
		class TestError1 extends Error { }
		class TestError3 extends Error { }

		const task1 = new Task<number>(() => Promise.reject(new TestError1("Fake Error 1")));
		const task2 = new Task<string>(() => Promise.resolve("42"));
		const task3 = new Task<boolean>(() => { throw new TestError3("Fake Error 3"); });

		let expectedError;
		try {
			await Task.waitAll(task1, task2, task3);
		} catch (e) {
			expectedError = e;
		}

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);

		assert.isTrue(task2.isCompleted);
		assert.isFalse(task2.isCancelled);
		assert.isFalse(task2.isFaulted);

		assert.isTrue(task3.isCompleted);
		assert.isFalse(task3.isCancelled);
		assert.isTrue(task3.isFaulted);

		assert.equal(task2.result, "42");

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, AggregateError);
		assert.equal(expectedError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerError);
		assert.instanceOf(expectedError.innerError, TestError1);
		assert.equal(expectedError.innerError.message, "Fake Error 1");

		assert.isDefined(expectedError.innerErrors);
		assert.isArray(expectedError.innerErrors);
		assert.equal(expectedError.innerErrors.length, 2);
		assert.instanceOf(expectedError.innerErrors[0], TestError1);
		assert.equal(expectedError.innerErrors[0].message, "Fake Error 1");
		assert.instanceOf(expectedError.innerErrors[1], TestError3);
		assert.equal(expectedError.innerErrors[1].message, "Fake Error 3");
	});
	it("Should cancel a task via CancelListener", async () => {
		class MyCancelError extends Error { }
		const cancellationTokenSource = Task.createCancellationTokenSource();
		let isTimeoutHappened = false;
		const task1 = new Task<number>(
			(token) => {
				// Fake long task
				return new Promise<number>((resolve, reject) => {
					const timeout = setTimeout(() => { isTimeoutHappened = true; resolve(42); }, 1000);
					token.addCancelListener(() => {
						clearTimeout(timeout);
						reject(new MyCancelError("Cancelled while wait for timer"));
					});
				});
			},
			cancellationTokenSource.token
		);

		let expectedError;
		try {
			const taskPromise = task1.wait();
			cancellationTokenSource.cancel();
			await taskPromise;
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, MyCancelError);
		assert.equal(expectedError.message, "Cancelled while wait for timer");
		assert.isFalse(isTimeoutHappened);
		assert.isTrue(task1.isCompleted);
		assert.isTrue(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
	});
	it("Should cancel a task via isCancellationRequested", async () => {
		class MyCancelError extends Error { }
		const cancellationTokenSource = Task.createCancellationTokenSource();
		const task1 = new Task<number>(
			async (token) => {
				for (let index = 0; index < 10; index++) {
					await Task.sleep(10).wait();
					if (token.isCancellationRequested) {
						throw new MyCancelError("Cancelled while wait for timer");
					}
				}
				return 42;
			},
			cancellationTokenSource.token
		);

		let expectedError;
		try {
			const taskPromise = task1.wait();
			cancellationTokenSource.cancel();
			await taskPromise;
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, MyCancelError);
		assert.equal(expectedError.message, "Cancelled while wait for timer");
		assert.isTrue(task1.isCompleted);
		assert.isTrue(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
	});
	it("Should cancel a task via throwIfCancellationRequested and waitAll()", async () => {
		const cancellationTokenSource = Task.createCancellationTokenSource();
		cancellationTokenSource.token.throwIfCancellationRequested();
		const task1 = new Task<number>(
			async (token) => {
				for (let index = 0; index < 10; index++) {
					token.throwIfCancellationRequested();
					await Task.sleep(10).wait();
				}
				return 42;
			},
			cancellationTokenSource.token
		);

		let expectedError;
		try {
			setTimeout(() => cancellationTokenSource.cancel(), 25);
			await Task.waitAll(task1);
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, CancelledError);
		assert.isEmpty(expectedError.message);
		assert.isTrue(task1.isCompleted);
		assert.isTrue(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
	});
	it("Should NOT cancel a task via throwIfCancellationRequested", async () => {
		const task1 = new Task<number>(
			async (token) => {
				for (let index = 0; index < 10; index++) {
					await Task.sleep(10).wait();
					token.throwIfCancellationRequested();
				}
				return 42;
			}
		);

		await task1.wait();

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should not cancel a task after removeCancelListener()", async () => {
		class MyCancelError extends Error { }
		const cancellationTokenSource = Task.createCancellationTokenSource();
		let isTimeoutHappened = false;
		const task1 = new Task<number>(
			(token) => {
				// Fake long task
				return new Promise<number>((resolve, reject) => {
					const timeout = setTimeout(() => { isTimeoutHappened = true; resolve(42); }, 100);
					function cancelCallback() {
						clearTimeout(timeout);
						reject(new MyCancelError("Cancelled while wait for timer"));
					}
					token.addCancelListener(cancelCallback);
					token.removeCancelListener(cancelCallback);
				});
			},
			cancellationTokenSource.token
		);

		const taskPromise = task1.wait();
		cancellationTokenSource.cancel();
		await taskPromise;

		assert.isTrue(isTimeoutHappened);
		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should allow multiple calls for removeCancelListener()", async () => {
		class MyCancelError extends Error { }
		const cancellationTokenSource = Task.createCancellationTokenSource();
		let isTimeoutHappened = false;
		const task1 = new Task<number>(
			(token) => {
				// Fake long task
				return new Promise<number>((resolve, reject) => {
					const timeout = setTimeout(() => { isTimeoutHappened = true; resolve(42); }, 100);
					function cancelCallback() {
						clearTimeout(timeout);
						reject(new MyCancelError("Cancelled while wait for timer"));
					}
					token.addCancelListener(cancelCallback);
					token.removeCancelListener(cancelCallback);
					token.removeCancelListener(cancelCallback);
					token.removeCancelListener(cancelCallback);
				});
			},
			cancellationTokenSource.token
		);

		const taskPromise = task1.wait();
		cancellationTokenSource.cancel();
		await taskPromise;

		assert.isTrue(isTimeoutHappened);
		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should allow multiple calls for cancel()", async () => {
		const cancellationTokenSource = Task.createCancellationTokenSource();
		const task1 = new Task<number>(
			async (token) => 42,
			cancellationTokenSource.token
		);

		const taskPromise = task1.wait();
		cancellationTokenSource.cancel();
		cancellationTokenSource.cancel();
		cancellationTokenSource.cancel();
		await taskPromise;

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should call all listeners on cancel() and then raise errors", async () => {
		const cancellationTokenSource = Task.createCancellationTokenSource();
		const token = cancellationTokenSource.token;

		let listener1Done = false;
		let listener2Done = false;

		token.addCancelListener(() => { listener1Done = true; throw Error(); });
		token.addCancelListener(() => { listener2Done = true; throw Error(); });

		let expectedError;
		try {
			cancellationTokenSource.cancel();
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, AggregateError);
		assert.isTrue(listener1Done);
		assert.isTrue(listener2Done);
	});
	it("Should raise error when access result of a broken task", async () => {
		class TestError extends Error { }

		const task1 = new Task<number>(() => { throw new TestError("Fake Error"); });

		{
			let expectedError;
			try {
				await task1.wait();
			} catch (e) {
				expectedError = e;
			}

			assert.isTrue(task1.isCompleted);
			assert.isFalse(task1.isCancelled);
			assert.isTrue(task1.isFaulted);
			assert.isDefined(expectedError);
			assert.instanceOf(expectedError, TestError);
			assert.equal(expectedError.message, "Fake Error");
		}

		{
			let expectedError2;
			try {
				const notUsed = task1.result;
				assert.isUndefined(notUsed);
			} catch (e) {
				expectedError2 = e;
			}
			assert.isDefined(expectedError2);
			assert.instanceOf(expectedError2, Error);
			assert.include(expectedError2.message, "Invalid operation");
		}
	});
	it("Should cancel sleep()", async () => {
		const cancellationTokenSource = Task.createCancellationTokenSource();
		const sleepTask = Task.sleep(1000, cancellationTokenSource.token);
		await Task.sleep(25).wait();

		cancellationTokenSource.cancel();

		let expectedError;
		try {
			await sleepTask.wait();
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, CancelledError);
	});
	it("Should raise error AggregateError when no innerErrors", async () => {
		let expectedError;
		try {
			throw new AggregateError([]);
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.notInstanceOf(expectedError, AggregateError);
	});
});
