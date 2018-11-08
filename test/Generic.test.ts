import { assert } from "chai";

import { Task, AggregateError, CanceledError, WrapError } from "../src/index";

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

	it("Should hanle error fail for synchronous task", async () => {
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
	it("Should hanle error fail for asynchronous task", async () => {
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
	it("Should hanle non-error fail for synchronous task", async () => {
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
	it("Should hanle non-error fail for asynchronous task", async () => {
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
});
