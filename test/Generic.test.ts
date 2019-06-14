import * as zxteam from "@zxteam/contract";
import { assert } from "chai";

import { Task as TaskLike } from "@zxteam/contract";

import { Task, AggregateError, CancelledError, WrapError, InvalidOperationError } from "../src/index";

describe("Generic tests", () => {
	it("Should wait for synchronous task", async () => {
		const task1 = Task.create<number>(() => {
			return 42;
		});

		await task1;

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should wait for asynchronous task", async () => {
		const task1 = Task.create<number>(() => Promise.resolve(42));

		await task1;

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should waitAll no any tasks", async () => {
		await Task.waitAll();
	});
	it("Should waitAll for synchronous task", async () => {
		const task1 = Task.create<number>(() => 42);

		await Task.waitAll(task1);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should waitAll for asynchronous task", async () => {
		const task1 = Task.create<number>(() => Promise.resolve(42));

		await Task.waitAll(task1);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should waitAll for synchronous tasks", async () => {
		const task1 = Task.create<number>(() => 42);
		const task2 = Task.create<string>(() => "42");
		const task3 = Task.create<boolean>(() => true);

		await Task.waitAll(task1, task2, task3);

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
		const task1 = Task.create<number>(() => Promise.resolve(42));
		const task2 = Task.create<string>(() => Promise.resolve("42"));
		const task3 = Task.create<boolean>(() => Promise.resolve(true));
		const task4 = Task.create<void>(() => Promise.resolve());

		await Task.waitAll(task1, task2, task3, task4);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);

		assert.isTrue(task2.isCompleted);
		assert.isFalse(task2.isCancelled);
		assert.isFalse(task2.isFaulted);

		assert.isTrue(task3.isCompleted);
		assert.isFalse(task3.isCancelled);
		assert.isFalse(task3.isFaulted);

		assert.isTrue(task4.isCompleted);
		assert.isFalse(task4.isCancelled);
		assert.isFalse(task4.isFaulted);

		assert.equal(task1.result, 42);
		assert.equal(task2.result, "42");
		assert.equal(task3.result, true);
	});
	it("Should waitAll for mixed (synchronous/asynchronous) tasks", async () => {
		const task1 = Task.create<number>(() => Promise.resolve(42));
		const task2 = Task.create<string>(() => "42");
		const task3 = Task.create<boolean>(() => Promise.resolve(true));

		await Task.waitAll(task1, task2, task3);

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

		const task1 = Task.create<number>(() => { throw new TestError("Fake Error"); });

		let expectedError;
		try {
			await task1;
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
	it("Should handle error fail for synchronous task via catch()", async () => {
		class TestError extends Error { }

		const task1 = Task.create<number>(() => { throw new TestError("Fake Error"); });

		let expectedError: any;
		await task1.promise.catch((reason) => expectedError = reason);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isTrue(task1.isFaulted);
		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, TestError);
		assert.equal(expectedError.message, "Fake Error");
	});
	it("Should handle error fail for asynchronous task", async () => {
		class TestError extends Error { }

		const task1 = Task.create<number>(() => Promise.reject(new TestError("Fake Error")));

		let expectedError;
		try {
			await task1;
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

		const task1 = Task.create<number>(() => Promise.reject(new TestError("Fake Error")));

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
		assert.instanceOf(expectedError, AggregateError);
		assert.instanceOf((expectedError as AggregateError).innerError, TestError);
		assert.equal((expectedError as AggregateError).innerError.message, "Fake Error");
	});
	it("Should handle non-error fail for synchronous task", async () => {
		const task1 = Task.create<number>(() => { throw "Fake Error"; });

		let expectedError;
		try {
			await task1;
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
		const task1 = Task.create<number>(() => Promise.reject("Fake Error"));

		let expectedError;
		try {
			await task1;
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

		const task1 = Task.create<number>(() => { throw new TestError1("Fake Error 1"); });
		const task2 = Task.create<string>(() => { throw new TestError2("Fake Error 2"); });
		const task3 = Task.create<boolean>(() => { throw new TestError3("Fake Error 3"); });

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

		const task1 = Task.create<number>(() => Promise.reject(new TestError1("Fake Error 1")));
		const task2 = Task.create<string>(() => Promise.reject(new TestError2("Fake Error 2")));
		const task3 = Task.create<boolean>(() => Promise.reject(new TestError3("Fake Error 3")));

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

		const task1 = Task.create<number>(() => Promise.reject(new TestError1("Fake Error 1")));
		const task2 = Task.create<string>(() => { throw new TestError2("Fake Error 2"); });
		const task3 = Task.create<boolean>(() => Promise.reject(new TestError3("Fake Error 3")));

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

		const task1 = Task.create<number>(() => { throw new TestError1("Fake Error 1"); });
		const task2 = Task.create<string>(() => "42");
		const task3 = Task.create<boolean>(() => { throw new TestError3("Fake Error 3"); });

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

		const task1 = Task.create<number>(() => Promise.reject(new TestError1("Fake Error 1")));
		const task2 = Task.create<string>(() => Promise.resolve("42"));
		const task3 = Task.create<boolean>(() => Promise.reject(new TestError3("Fake Error 3")));

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

		const task1 = Task.create<number>(() => Promise.reject(new TestError1("Fake Error 1")));
		const task2 = Task.create<string>(() => Promise.resolve("42"));
		const task3 = Task.create<boolean>(() => { throw new TestError3("Fake Error 3"); });

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
		class MyCancelError extends CancelledError { }
		const cancellationTokenSource = Task.createCancellationTokenSource();
		let isTimeoutHappened = false;
		const task1 = Task.create<number>(
			(token) => {
				// Fake long task
				return new Promise<number>((resolve, reject) => {
					const timeout = setTimeout(() => {
						isTimeoutHappened = true;
						resolve(42);
					}, 1000);
					token.addCancelListener(() => {
						clearTimeout(timeout);
						reject(new MyCancelError("Cancelled while wait for timer"));
					});
				});
			},
			cancellationTokenSource.token
		).start();

		let expectedError;
		try {
			await Task.sleep(50); // give a time for start task1
			cancellationTokenSource.cancel();
			await task1;
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
		class MyCancelError extends CancelledError { }
		const cancellationTokenSource = Task.createCancellationTokenSource();
		const task1 = Task.create<number>(
			async (token) => {
				for (let index = 0; index < 10; index++) {
					await Task.sleep(10);
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
			task1.start();
			await Task.sleep(50);
			cancellationTokenSource.cancel();
			await task1;
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
		const task1 = Task.create<number>(
			async (token) => {
				for (let index = 0; index < 10; index++) {
					token.throwIfCancellationRequested();
					await Task.sleep(10);
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
		assert.instanceOf(expectedError, AggregateError);
		assert.instanceOf((expectedError as AggregateError).innerError, CancelledError);
		assert.isEmpty((expectedError as AggregateError).innerError.message);
		assert.isTrue(task1.isCompleted);
		assert.isTrue(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
	});
	it("Should cancel a task via CancelledError like error", async () => {
		class TestCancelledError extends Error implements zxteam.CancelledError {
			public readonly name = "CancelledError";
			public readonly testFlag = true;
		}

		const task = Task.create(
			() => {
				throw new TestCancelledError();
			}
		);

		let expectedError;
		try {
			await task;
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, TestCancelledError);
		assert.isTrue(task.isCompleted);
		assert.isFalse(task.isSuccessed);
		assert.isTrue(task.isCancelled);
		assert.isFalse(task.isFaulted);
	});
	it("Should NOT cancel a task via throwIfCancellationRequested", async () => {
		const task1 = Task.create<number>(
			async (token) => {
				for (let index = 0; index < 10; index++) {
					await Task.sleep(10);
					token.throwIfCancellationRequested();
				}
				return 42;
			}
		);

		await task1;

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should not cancel a task after removeCancelListener()", async () => {
		class MyCancelError extends Error { }
		const cancellationTokenSource = Task.createCancellationTokenSource();
		let isTimeoutHappened = false;
		const task1 = Task.create<number>(
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

		const taskPromise = task1;
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
		const task1 = Task.create<number>(
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

		const taskPromise = task1;
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
		const task1 = Task.create<number>(
			async (token) => 42,
			cancellationTokenSource.token
		);

		const taskPromise = task1;
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

		const task1 = Task.create<number>(() => { throw new TestError("Fake Error"); });

		{
			let expectedError;
			try {
				await task1;
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
			assert.instanceOf(expectedError2, TestError);
			assert.include(expectedError2.message, "Fake Error");
		}
	});
	it("Should cancel sleep() before started", async () => {
		const cancellationTokenSource = Task.createCancellationTokenSource();
		cancellationTokenSource.cancel();
		const sleepTask = Task.sleep(1000, cancellationTokenSource.token);
		await Task.sleep(25);

		let expectedError;
		try {
			await sleepTask;
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, CancelledError);
	});
	it("Should cancel sleep() after start", async () => {
		const cancellationTokenSource = Task.createCancellationTokenSource();
		const sleepTask = Task.sleep(1000, cancellationTokenSource.token);
		await Task.sleep(25);

		cancellationTokenSource.cancel();

		let expectedError;
		try {
			await sleepTask;
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, CancelledError);
	});
	it("Should cancel sleep() via cancellationToken", async () => {
		const cancellationTokenSource = Task.createCancellationTokenSource();
		const sleepTask = Task.sleep(cancellationTokenSource.token);

		await Task.sleep(10);

		cancellationTokenSource.cancel();

		await Task.sleep(10);

		let expectedError;
		try {
			await sleepTask;
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, CancelledError);
	});
	it("Should cancel sleep() via Timeout", async () => {
		const cancellationTokenSource = Task.createTimeoutCancellationTokenSource(25);

		const sleepTask = Task.sleep(1000, cancellationTokenSource.token);
		await Task.sleep(25);

		let expectedError;
		try {
			await sleepTask;
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, CancelledError);
	});
	it("Should cancel sleep() via Timeout before start", async () => {
		const cancellationTokenSource = Task.createTimeoutCancellationTokenSource(24 * 60 * 60 * 1000/* long timeout */);

		cancellationTokenSource.cancel();

		const sleepTask = Task.sleep(1000, cancellationTokenSource.token);

		await Task.sleep(25);

		let expectedError;
		try {
			await sleepTask;
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, CancelledError);
	});
	it("Should cancel sleep() via Timeout + call cancel()", async () => {
		const cancellationTokenSource = Task.createTimeoutCancellationTokenSource(24 * 60 * 60 * 1000/* long timeout */);

		const sleepTask = Task.sleep(1000, cancellationTokenSource.token);

		await Task.sleep(25);

		assert.isFalse(sleepTask.isSuccessed);
		assert.isFalse(sleepTask.isCompleted);
		assert.isFalse(sleepTask.isCancelled);
		assert.isFalse(sleepTask.isFaulted);

		cancellationTokenSource.cancel();

		let expectedError;
		try {
			await sleepTask;
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, CancelledError);

		assert.isFalse(sleepTask.isSuccessed);
		assert.isTrue(sleepTask.isCancelled);
		assert.isFalse(sleepTask.isFaulted);
		assert.isTrue(sleepTask.isCompleted);
	});
	it("Should create an instace of AggregateError when no innerErrors", async () => {
		let expectedError: any = null;
		try {
			throw new AggregateError([]);
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.isNotNull(expectedError);
		assert.instanceOf(expectedError, AggregateError);
	});
	it("Should not execute catch() callback. Bug occurs in version 0.0.3", async () => {
		const task1 = Task.create<number>(() => 42);

		let unexpectedReason;
		await task1.promise.catch((reason) => { unexpectedReason = reason; });

		assert.isUndefined(unexpectedReason);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
	});
	it("Should not execute catch() callback and returns result. Bug occurs in version 0.0.4", async () => {
		const task1 = Task.create<number>(() => 42);

		let unexpectedReason;
		const result = await task1.promise.catch((reason) => { unexpectedReason = reason; });

		assert.isUndefined(unexpectedReason);

		assert.isTrue(task1.isCompleted);
		assert.isFalse(task1.isCancelled);
		assert.isFalse(task1.isFaulted);
		assert.equal(task1.result, 42);
		assert.equal(result, 42);
	});
	it("Should be able to pass array of tasks to waitAll()", async () => {
		const task0 = Task.create<string>(() => "forty two");
		const task1 = Task.create<boolean>(() => false);
		const task2 = Task.create<number>(() => 42);

		const tasks: Array<Task<any>> = [task0, task1, task2];

		const waitAllTask = Task.waitAll(tasks);

		assert.isFalse(task0.isCompleted);
		assert.isFalse(task1.isCompleted);
		assert.isFalse(task2.isCompleted);

		assert.isFalse(waitAllTask.isCompleted);

		await waitAllTask;

		assert.isTrue(waitAllTask.isCompleted);

		assert.isTrue(task0.isSuccessed);
		assert.isTrue(task1.isSuccessed);
		assert.isTrue(task2.isSuccessed);
	});
	it("Should be able to pass array of tasks to waitAll() via destruction", async () => {
		const task0 = Task.create<string>(() => "forty two");
		const task1 = Task.create<boolean>(() => false);
		const task2 = Task.create<number>(() => 42);

		const tasks: Array<Task<any>> = [task0, task1, task2];

		await Task.waitAll(...tasks);

		assert.isTrue(task0.isSuccessed);
		assert.isTrue(task1.isSuccessed);
		assert.isTrue(task2.isSuccessed);
	});
	it("Should auto relase callbacks on cancel()", async () => {
		const cts = Task.createCancellationTokenSource();
		const cancelListeners = (cts as any)._cancelListeners;
		const token = cts.token;
		assert.isArray(cancelListeners);
		assert.equal(cancelListeners.length, 0, "cancelListeners should have no any listeners");
		const cb = () => { /* stub */ };
		token.addCancelListener(cb);
		assert.equal(cancelListeners.length, 1, "cancelListeners should have one listener");
		cts.cancel();
		assert.equal(cancelListeners.length, 0, "cancelListeners should have no any listeners after cts.cancel()");
		token.removeCancelListener(cb); // No error
		assert.throw(() => token.throwIfCancellationRequested(), CancelledError);
	});
	it("Propery result should throw error in case cancel()", async function () {
		const cts = Task.createCancellationTokenSource();

		const task = Task.create(async (token) => {
			while (true) {
				token.throwIfCancellationRequested(); // wait for cancel
				await new Promise(r => setTimeout(r, 5));
			}
		}, cts.token).start();

		await new Promise(r => setTimeout(r, 5));

		assert.isFalse(task.isCancelled);
		assert.isFalse(task.isCompleted);
		assert.isFalse(task.isSuccessed);
		assert.isFalse(task.isFaulted);

		cts.cancel();

		await new Promise(r => setTimeout(r, 25));

		assert.isTrue(task.isCancelled);
		assert.isTrue(task.isCompleted);
		assert.isFalse(task.isSuccessed);
		assert.isFalse(task.isFaulted);

		assert.throw(() => task.result, CancelledError);
	});
	it("then should return instance of task", async () => {
		let taskStarted = false;
		let expectedRes: any = null;
		const testTask = Task.create(() => {
			taskStarted = true;
			return 42;
		});
		const thenTask = testTask.then((result) => {
			expectedRes = result;
		});
		await new Promise(r => setTimeout(r, 25));
		assert.isTrue(taskStarted, "The task should start when catch() called");
		assert.isTrue(testTask.isSuccessed, "The task should be successed");
		assert.instanceOf(thenTask, Promise, "The type of an instance of a catch() result should be Task");
		assert.equal(expectedRes, 42, "then should pass result of previous task into callback");
	});
	it("catch should produce callback with argument of the Error type #1", async () => {
		let taskStarted = false;
		let expectedErr: any = null;
		const testTask = Task.create(() => {
			taskStarted = true;
			throw "Non error throw";
		});
		testTask.promise.catch((err) => { expectedErr = err; });
		await new Promise(r => setTimeout(r, 25));

		assert.isTrue(taskStarted, "The task should start when catch() called");
		assert.isTrue(testTask.isFaulted, "The task should be faulted");
		assert.instanceOf(expectedErr, WrapError, "The error produced by the task should be wrapped into WrapError");
		assert.equal((expectedErr as WrapError).message, "Non error throw");
	});
	it("catch should produce callback with argument of the Error type #2", async () => {
		let taskStarted = false;
		let expectedErr: any = null;
		const testTask = Task.create(() => {
			taskStarted = true;
			throw 42;
		});
		testTask.promise.catch((err) => { expectedErr = err; });
		await new Promise(r => setTimeout(r, 25));

		assert.isTrue(taskStarted, "The task should start when catch() called");
		assert.isTrue(testTask.isFaulted, "The task should be faulted");
		assert.instanceOf(expectedErr, WrapError, "The error produced by the task should be wrapped into WrapError");
		assert.equal((expectedErr as WrapError).message, "42");
	});
	it("catch should produce callback with argument of the Error type #3", async () => {
		const errorSubj = { fake: 0 };
		let taskStarted = false;
		let expectedErr: any = null;
		const testTask = Task.create(() => {
			taskStarted = true;
			throw errorSubj;
		});
		testTask.promise.catch((err) => { expectedErr = err; });
		await new Promise(r => setTimeout(r, 25));

		assert.isTrue(taskStarted, "The task should start when catch() called");
		assert.isTrue(testTask.isFaulted, "The task should be faulted");
		assert.instanceOf(expectedErr, WrapError, "The error produced by the task should be wrapped into WrapError");
		assert.equal((expectedErr as WrapError).message, errorSubj.toString());
	});
	it("Positive Task should provide wait (error-safe) promise", async () => {
		const task: TaskLike = Task.create(() => new Promise(r => setTimeout(r, 10)));

		assert.isFalse(task.isCancelled);
		assert.isFalse(task.isCompleted);
		assert.isFalse(task.isFaulted);
		assert.isFalse(task.isSuccessed);

		await task.wait();

		assert.isFalse(task.isCancelled);
		assert.isTrue(task.isCompleted);
		assert.isFalse(task.isFaulted);
		assert.isTrue(task.isSuccessed);
	});
	it("Fail Task should provide wait (error-safe) promise", async () => {
		const task: TaskLike = Task.create(() => new Promise((r, j) => setTimeout(j, 10)));

		assert.isFalse(task.isCancelled);
		assert.isFalse(task.isCompleted);
		assert.isFalse(task.isFaulted);
		assert.isFalse(task.isSuccessed);

		await task.wait();

		assert.isFalse(task.isCancelled);
		assert.isTrue(task.isCompleted);
		assert.isTrue(task.isFaulted);
		assert.isFalse(task.isSuccessed);
	});
	it("Cancel Task should provide wait (error-safe) promise", async () => {
		const task: TaskLike = Task.create(() => { throw new CancelledError("Test cancel"); });

		assert.isFalse(task.isCancelled);
		assert.isFalse(task.isCompleted);
		assert.isFalse(task.isFaulted);
		assert.isFalse(task.isSuccessed);

		await task.wait();

		assert.isTrue(task.isCancelled);
		assert.isTrue(task.isCompleted);
		assert.isFalse(task.isFaulted);
		assert.isFalse(task.isSuccessed);
	});
	it("Should be able to create task via Task.resolve()", async () => {
		const task: TaskLike = Task.resolve();

		await task.wait();

		assert.isFalse(task.isCancelled);
		assert.isTrue(task.isCompleted);
		assert.isFalse(task.isFaulted);
		assert.isTrue(task.isSuccessed);
	});
	it("Should be able to create task via Task.reject()", async () => {
		class TestError extends Error { }
		const error = new TestError("Test fail");
		const task: TaskLike = Task.reject(error);

		await task.wait();

		assert.isFalse(task.isCancelled);
		assert.isTrue(task.isCompleted);
		assert.isTrue(task.isFaulted);
		assert.isFalse(task.isSuccessed);

		assert.instanceOf(task.error, TestError);
		assert.equal(task.error.message, "Test fail");
	});
	it("Should wrap non-Error exception", async () => {
		const task: TaskLike = Task.run(() => { throw "Test fail"; });

		await task.wait();

		assert.isFalse(task.isCancelled);
		assert.isTrue(task.isCompleted);
		assert.isTrue(task.isFaulted);
		assert.isFalse(task.isSuccessed);

		assert.instanceOf(task.error, WrapError);
		assert.equal(task.error.message, "Test fail");
	});
	it("Should raise InvalidOperationError exception on property 'result' before task completed", async () => {
		const task: TaskLike = Task.sleep(100);

		let expectedError;
		try {
			const nomatter = task.result;
		} catch (e) {
			expectedError = e;
		}

		assert.instanceOf(expectedError, InvalidOperationError);
		assert.equal(expectedError.message, "Invalid operation at current state.");
	});
	it("Should raise InvalidOperationError exception on property 'error' before task completed", async () => {
		const task: TaskLike = Task.sleep(100);

		let expectedError;
		try {
			const nomatter = task.error;
		} catch (e) {
			expectedError = e;
		}

		assert.instanceOf(expectedError, InvalidOperationError);
		assert.equal(expectedError.message, "Invalid operation at current state.");
	});
	it("Should raise InvalidOperationError exception on start() if task already running", async () => {
		const task = Task.sleep(100) as Task<void>;

		let expectedError;
		try {
			task.start();
		} catch (e) {
			expectedError = e;
		}

		assert.instanceOf(expectedError, InvalidOperationError);
		assert.equal(expectedError.message, "Invalid operation at current state. The task already started.");
	});
	it("continue on resolved task should works (static result)", async function () {
		let wasContinuteCalled = false;
		await Task.resolve(42).continue(() => { wasContinuteCalled = true; }).wait();
		assert.isTrue(wasContinuteCalled, "continue callback was not called, but have to");
	});
	it("continue on resolved task should works (promisable result)", async function () {
		let wasContinuteCalled = false;
		await Task.resolve(Promise.resolve(42)).continue(() => { wasContinuteCalled = true; }).wait();
		assert.isTrue(wasContinuteCalled, "continue callback was not called, but have to");
	});
});
