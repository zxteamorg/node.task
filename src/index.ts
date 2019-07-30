const { name: packageName, version: packageVersion } = require(require("path").join(__dirname, "..", "package.json"));
const G: any = global || window || {};
const PACKAGE_GUARD: symbol = Symbol.for(packageName);
if (PACKAGE_GUARD in G) {
	const conflictVersion = G[PACKAGE_GUARD];
	// tslint:disable-next-line: max-line-length
	const msg = `Conflict module version. Look like two different version of package ${packageName} was loaded inside the process: ${conflictVersion} and ${packageVersion}.`;
	if (process !== undefined && process.env !== undefined && process.env.NODE_ALLOW_CONFLICT_MODULES === "1") {
		console.warn(msg + " This treats as warning because NODE_ALLOW_CONFLICT_MODULES is set.");
	} else {
		throw new Error(msg + " Use NODE_ALLOW_CONFLICT_MODULES=\"1\" to treats this error as warning.");
	}
} else {
	G[PACKAGE_GUARD] = packageVersion;
}

import * as zxteam from "@zxteam/contract";
import {
	DUMMY_CANCELLATION_TOKEN, CancellationTokenSource,
	SimpleCancellationTokenSource, TimeoutCancellationTokenSource
} from "@zxteam/cancellation";
import { AggregateError, CancelledError, InvalidOperationError, wrapErrorIfNeeded } from "@zxteam/errors";


const enum TaskStatus {
	Created = 0,
	Running = 3,
	Successed = 5,
	Canceled = 6,
	Faulted = 7
}

class AssertError extends Error {
	public readonly name = "AssertError";
}


export class Task<T> implements zxteam.Task<T> {
	private readonly _taskFn: ((cancellationToken: zxteam.CancellationToken) => T | Promise<T> | zxteam.Task<T>);
	private readonly _cancellationToken: zxteam.CancellationToken;

	private _status: TaskStatus;
	private _promise?: Promise<T>;
	private _result?: T;
	private _error?: Error;
	private _continuationTasks?: Array<{ start: () => any; isStarted: boolean }>;

	public get error(): Error {
		if (this._status === TaskStatus.Faulted || this._status === TaskStatus.Canceled) {
			return this._error as Error;
		}
		throw new InvalidOperationError("Invalid operation at current state.");
	}
	public get result(): T {
		if (this._status === TaskStatus.Successed) { return this._result as T; }
		if (this._error !== undefined) { throw this._error; }
		throw new InvalidOperationError("Invalid operation at current state.");
	}

	public get cancellationToken(): zxteam.CancellationToken {
		return this._cancellationToken;
	}

	public get promise(): Promise<T> {
		if (this._status === TaskStatus.Created) {
			// Start task if not started yet
			this.start();
		}

		if (this._promise === undefined) { throw new AssertError("Promise should exists"); }

		return this._promise;
	}

	public get isCompleted(): boolean {
		return this._status === TaskStatus.Successed || this.isFaulted || this.isCancelled;
	}
	public get isSuccessed(): boolean {
		return this._status === TaskStatus.Successed;
	}
	public get isFaulted(): boolean {
		return this._status === TaskStatus.Faulted;
	}
	public get isCancelled(): boolean {
		return this._status === TaskStatus.Canceled;
	}
	public get isStarted(): boolean {
		return this._status !== TaskStatus.Created;
	}

	public continue<TContinue>(
		fnOrTask: ((parentTask: zxteam.Task<T>) => TContinue | Promise<TContinue> | zxteam.Task<TContinue>) | zxteam.Task<TContinue>
	): zxteam.Task<TContinue> {
		const subTask = Task.create(
			async () => {
				if (typeof fnOrTask === "object" && "promise" in fnOrTask) {
					// we have not ability to pass this task to attached task, so just await for fulfill the promise
					await this.promise;
					return fnOrTask.promise;
				}

				await this.wait(); // wait this task for compete (wait() does not produce any errors)
				const fnResult = fnOrTask(this);
				if (fnResult instanceof Promise) {
					return fnResult;
				} else if (typeof fnResult === "object" && "promise" in fnResult) {
					return fnResult.promise;
				}
				return fnResult;
			},
			this.cancellationToken
		);

		if (this.isCompleted) {
			subTask.start();
		} else {
			if (this._continuationTasks === undefined) { this._continuationTasks = []; }
			this._continuationTasks.push(subTask);
		}

		return subTask;
	}

	public ensureSuccess(): void {
		if (!this.isCompleted) { throw new Error("The task not finished yet."); }
		if (!this.isSuccessed) { throw this._error; }
	}

	public then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2> {
		return this.promise.then(onfulfilled, onrejected);
	}

	public start(): this {
		if (this._status !== TaskStatus.Created) {
			throw new InvalidOperationError("Invalid operation at current state. The task already started.");
		}
		if (this._promise !== undefined) { throw new AssertError("promise !== undefined"); }

		this._promise = Promise.resolve()
			.then(() => {
				const taskResult = this._taskFn(this._cancellationToken);
				if (typeof taskResult === "object" && "promise" in taskResult) {
					return taskResult.promise;
				}
				return taskResult;
			})
			.then((result) => {
				this._result = result;
				this._status = TaskStatus.Successed;
				return result;
			})
			.catch((err) => {
				throw wrapErrorIfNeeded(err);
			}).finally(() => {
				if (this._continuationTasks !== undefined) {
					this._continuationTasks.forEach(subTask => { if (!subTask.isStarted) { subTask.start(); } });
					delete this._continuationTasks;
				}
			});
		this._promise.catch((err) => {
			if (err instanceof CancelledError) {
				this._status = TaskStatus.Canceled;
				this._error = err;
				return;
			} else if (err instanceof Error && err.name === "CancelledError") {
				this._error = err;
				this._status = TaskStatus.Canceled;
				return;
			}
			this._status = TaskStatus.Faulted;
			this._error = err;
		});

		this._status = TaskStatus.Running;

		return this;
	}

	public async wait(): Promise<void> {
		try {
			await this.promise;
		} catch (e) {
			/* BYPASS ANY ERRORS due method specific */
		}
	}

	private constructor(
		cancellationToken: zxteam.CancellationToken,
		taskFn: ((cancellationToken: zxteam.CancellationToken) => T | Promise<T> | zxteam.Task<T>)
	) {
		this._cancellationToken = cancellationToken;
		this._taskFn = taskFn;
		this._status = TaskStatus.Created;
		this._continuationTasks = [];
	}

	public static create<T = void>(taskFn: (cancellationToken: zxteam.CancellationToken) => T | Promise<T> | zxteam.Task<T>, cancellationToken?: zxteam.CancellationToken): Task<T> {
		if (cancellationToken === undefined) {
			cancellationToken = DUMMY_CANCELLATION_TOKEN;
		}
		return new Task(cancellationToken, taskFn);
	}

	public static reject<T = never>(reason: Error): zxteam.Task<T> {
		const task = new Task<T>(DUMMY_CANCELLATION_TOKEN, undefined as any);
		task._status = TaskStatus.Faulted;
		task._error = reason;
		task._promise = Promise.reject(reason);
		return task;
	}

	public static resolve(): zxteam.Task<void>;
	public static resolve<T = void>(value: T | PromiseLike<T>): zxteam.Task<T>;
	public static resolve<T>(value?: T | PromiseLike<T>): zxteam.Task<T> | zxteam.Task<void> {
		if (value !== undefined) {
			return Task.run(() => Promise.resolve(value));
		} else {
			const task = new Task<void>(DUMMY_CANCELLATION_TOKEN, undefined as any);
			task._status = TaskStatus.Successed;
			task._promise = Promise.resolve();
			return task;
		}
	}

	public static run<T = void>(task: (cancellationToken: zxteam.CancellationToken) => T | Promise<T>, cancellationToken?: zxteam.CancellationToken): zxteam.Task<T> {
		return Task.create(task, cancellationToken).start();
	}

	public static sleep(cancellationToken: zxteam.CancellationToken): zxteam.Task<never>;
	public static sleep(ms: number, cancellationToken?: zxteam.CancellationToken): zxteam.Task<void>;
	public static sleep(msOrCancellationToken: number | zxteam.CancellationToken, cancellationToken?: zxteam.CancellationToken): zxteam.Task<void> {
		const [ms, ct] = typeof msOrCancellationToken === "number" ?
			[msOrCancellationToken, cancellationToken] : [undefined, msOrCancellationToken];
		function worker(token: zxteam.CancellationToken) {
			return new Promise<void>((resolve, reject) => {
				if (token.isCancellationRequested) {
					return reject(new CancelledError());
				}

				let timeout: any = undefined;
				if (ms !== undefined) {
					timeout = setTimeout(function () {
						token.removeCancelListener(cancelCallback);
						return resolve();
					}, ms);
				}

				function cancelCallback() {
					token.removeCancelListener(cancelCallback);
					if (timeout !== undefined) {
						clearTimeout(timeout);
					}
					return reject(new CancelledError());
				}
				token.addCancelListener(cancelCallback);
			});
		}

		return Task.run(worker, ct);
	}

	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7, T8, T9>(task0: zxteam.Task<T0>, task1: zxteam.Task<T1>, task2: zxteam.Task<T2>, task3: zxteam.Task<T3>, task4: zxteam.Task<T4>, task5: zxteam.Task<T5>, task6: zxteam.Task<T6>, task7: zxteam.Task<T7>, task8: zxteam.Task<T8>, task9: zxteam.Task<T9>): zxteam.Task<[T0, T1, T2, T3, T4, T5, T6, T7, T8, T9]>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7, T8>(task0: zxteam.Task<T0>, task1: zxteam.Task<T1>, task2: zxteam.Task<T2>, task3: zxteam.Task<T3>, task4: zxteam.Task<T4>, task5: zxteam.Task<T5>, task6: zxteam.Task<T6>, task7: zxteam.Task<T7>, task8: zxteam.Task<T8>): zxteam.Task<[T0, T1, T2, T3, T4, T5, T6, T7, T8]>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7>(task0: zxteam.Task<T0>, task1: zxteam.Task<T1>, task2: zxteam.Task<T2>, task3: zxteam.Task<T3>, task4: zxteam.Task<T4>, task5: zxteam.Task<T5>, task6: Task<T6>, task7: zxteam.Task<T7>): zxteam.Task<[T0, T1, T2, T3, T4, T5, T6, T7]>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6>(task0: zxteam.Task<T0>, task1: zxteam.Task<T1>, task2: zxteam.Task<T2>, task3: zxteam.Task<T3>, task4: zxteam.Task<T4>, task5: zxteam.Task<T5>, task6: zxteam.Task<T6>): zxteam.Task<[T0, T1, T2, T3, T4, T5, T6]>;
	public static waitAll<T0, T1, T2, T3, T4, T5>(task0: zxteam.Task<T0>, task1: zxteam.Task<T1>, task2: zxteam.Task<T2>, task3: zxteam.Task<T3>, task4: zxteam.Task<T4>, task5: zxteam.Task<T5>): zxteam.Task<[T0, T1, T2, T3, T4, T5]>;
	public static waitAll<T0, T1, T2, T3, T4>(task0: zxteam.Task<T0>, task1: zxteam.Task<T1>, task2: zxteam.Task<T2>, task3: zxteam.Task<T3>, task4: zxteam.Task<T4>): zxteam.Task<[T0, T1, T2, T3, T4]>;
	public static waitAll<T0, T1, T2, T3>(task0: zxteam.Task<T0>, task1: zxteam.Task<T1>, task2: zxteam.Task<T2>, task3: zxteam.Task<T3>): zxteam.Task<[T0, T1, T2, T3]>;
	public static waitAll<T0, T1, T2>(task0: zxteam.Task<T0>, task1: zxteam.Task<T1>, task2: zxteam.Task<T2>): zxteam.Task<[T0, T1, T2]>;
	public static waitAll<T0, T1>(task0: zxteam.Task<T0>, task1: zxteam.Task<T1>): zxteam.Task<[T0, T1]>;
	public static waitAll<T>(task0: zxteam.Task<T>): zxteam.Task<T>;
	public static waitAll(tasks: Array<zxteam.Task<any>>): zxteam.Task<Array<any>>;
	public static waitAll(...tasks: Array<zxteam.Task<any>>): zxteam.Task<Array<any>>;
	public static waitAll(...tasks: any): zxteam.Task<Array<any>> {
		return Task.run<Array<any>>(async () => {
			if (tasks.length === 0) { return Promise.resolve([]); }
			if (tasks.length === 1) {
				if (Array.isArray(tasks[0])) {
					tasks = tasks[0];
				}
			}
			await Promise.all(tasks.map(
				(task: any) => task.promise.catch(() => { /** BYPASS ANY ERRORS. We collect its via task interface bellow */ })
			)); // Should never failed

			const results: Array<any> = [];
			const errors: Array<Error> = [];
			for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
				const task = tasks[taskIndex];
				if (task._status === TaskStatus.Successed) {
					results.push(task.result);
					continue;
				}
				if (task._status === TaskStatus.Faulted || task._status === TaskStatus.Canceled) {
					errors.push(task.error);
				} else {
					// Should never happened
					throw new AssertError("Wrong task status");
				}
			}

			if (errors.length > 0) {
				throw new AggregateError(errors);
			}

			return results;
		});
	}
}
