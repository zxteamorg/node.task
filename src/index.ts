import * as contract from "@zxteam/contract";

const enum TaskStatus {
	Created = 0,
	Running = 3,
	Successed = 5,
	Canceled = 6,
	Faulted = 7
}

class DummyCancellationToken implements contract.CancellationToken {
	public get isCancellationRequested(): boolean { return false; }
	public addCancelListener(cb: Function): void {/* Dummy */ }
	public removeCancelListener(cb: Function): void {/* Dummy */ }
	public throwIfCancellationRequested(): void {/* Dummy */ }
}
class CancellationTokenSourceImpl implements CancellationTokenSource {
	public readonly token: contract.CancellationToken;
	private readonly _cancelListeners: Array<Function> = [];
	private _isCancellationRequested: boolean;

	public constructor() {
		this._isCancellationRequested = false;
		const self = this;
		this.token = {
			get isCancellationRequested() { return self.isCancellationRequested; },
			addCancelListener(cb) { self.addCancelListener(cb); },
			removeCancelListener(cb) { self.removeCancelListener(cb); },
			throwIfCancellationRequested() { self.throwIfCancellationRequested(); }
		};
	}

	public get isCancellationRequested(): boolean { return this._isCancellationRequested; }

	public cancel(): void {
		if (this._isCancellationRequested) {
			// Prevent to call listeners twice
			return;
		}
		this._isCancellationRequested = true;
		const errors: Array<Error> = [];
		if (this._cancelListeners.length > 0) {
			const cancelListenersCopy = this._cancelListeners.slice();
			// We copy original array due callback can modify original array via removeCancelListener()
			cancelListenersCopy.forEach(cancelListener => {
				try {
					cancelListener();
				} catch (e) {
					errors.push(WrapError.wrapIfNeeded(e));
				}
			});
			if (this._cancelListeners.length > 0) {
				// Release callback. We do not need its anymore
				this._cancelListeners.splice(0);
			}
		}
		if (errors.length > 0) {
			throw new AggregateError(errors);
		}
	}

	private addCancelListener(cb: Function): void { this._cancelListeners.push(cb); }
	private removeCancelListener(cb: Function): void {
		const cbIndex = this._cancelListeners.indexOf(cb);
		if (cbIndex !== -1) {
			this._cancelListeners.splice(cbIndex, 1);
		}
	}
	private throwIfCancellationRequested(): void {
		if (this.isCancellationRequested) {
			throw new CancelledError();
		}
	}
}

const DummyCancellationTokenInstance = new DummyCancellationToken();

class AssertError extends Error {
}

export class WrapError extends Error {
	public readonly wrap: any;
	public constructor(wrap: any) {
		super(wrap && wrap.toString());
		this.wrap = wrap;
	}

	public static wrapIfNeeded(likeError: any): Error | WrapError {
		if (likeError instanceof Error) {
			return likeError;
		} else {
			return new WrapError(likeError);
		}

	}
}


export class AggregateError extends Error implements contract.AggregateError {
	public readonly name = "AggregateError";
	public readonly innerError: Error;
	public readonly innerErrors: Array<Error>;
	public constructor(innerErrors: Array<Error>) {
		super(innerErrors.length > 0 ? innerErrors[0].message : "AggregateError");
		this.innerError = innerErrors[0];
		this.innerErrors = innerErrors;
	}
}
export class CancelledError extends Error implements contract.CancelledError {
	public readonly name = "CancelledError";
}
export class InvalidOperationError extends Error implements contract.InvalidOperationError {
	public readonly name = "InvalidOperationError";
}

export interface CancellationTokenSource {
	readonly isCancellationRequested: boolean;
	readonly token: contract.CancellationToken;
	cancel(): void;
}

interface TaskRootEntry<T> {
	readonly task: (cancellationToken: contract.CancellationToken) => T | Promise<T>;
	readonly resolve: (value: T) => void;
	readonly reject: (reason: Error) => void;
	fulfilled: boolean;
	taskWorker: Promise<void> | null;

}
interface TaskEntry<T> {
	readonly cancellationToken: contract.CancellationToken;
	result?: T;
	error?: Error;
	status: TaskStatus;
}

const flagSymbol: Symbol = Symbol();

export type PromiseExecutor<T> = (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void;

export class Task<T> extends Promise<T> implements contract.Task<T> {
	// private readonly _task: (cancellationToken: contract.CancellationToken) => T | Promise<T>;
	// private readonly _cancellationToken: contract.CancellationToken;
	// private _taskWorker: Promise<void> | null;
	// private _result: T;
	// private _error: Error;
	private readonly _underlayingRootEntry?: TaskRootEntry<T>;
	private readonly _underlayingEntry: TaskEntry<T>;

	// public constructor(
	// 	task: (cancellationToken: contract.CancellationToken) => T | Promise<T>,
	// 	cancellationToken?: contract.CancellationToken
	// ) {
	// 	this._task = task;
	// 	this._cancellationToken = cancellationToken || DummyCancellationTokenInstance;

	// 	this._taskWorker = null;
	// 	this._status = TaskStatus.Created;
	// }


	public constructor(executor: PromiseExecutor<T>, flag?: Symbol, rootEntry?: TaskRootEntry<T>) {
		super(executor);

		// The flag passed from create() static method.
		if (flag !== flagSymbol) {
			// This is Non-Root Task
			// Just general Promise behaviour.
			return;
		}

		// This instance is a Root Task due called from create() static method.
		this._underlayingRootEntry = rootEntry;
	}

	public get error(): Error {
		if (this._status === TaskStatus.Faulted) {
			return this._underlayingEntry.error as Error;
		}
		throw new Error("Invalid operation at current state");
	}
	public get result(): T {
		if (this._status === TaskStatus.Successed) { return this._underlayingEntry.result as T; }
		throw new InvalidOperationError("Invalid operation at current state");
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

	// tslint:disable-next-line: max-line-length
	public then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2> {
		const underlayingRootEntry = this._underlayingRootEntry;

		if (underlayingRootEntry !== undefined) {
			if (this._status === TaskStatus.Created) { this.start(); }
			if (underlayingRootEntry.taskWorker === null) { throw new AssertError(); }

			if (this._status === TaskStatus.Successed) {
				if (!underlayingRootEntry.fulfilled) {
					underlayingRootEntry.resolve(this.result);
					underlayingRootEntry.fulfilled = true;
				}
			} else if (this._status === TaskStatus.Faulted || this._status === TaskStatus.Canceled) {
				if (!underlayingRootEntry.fulfilled) {
					underlayingRootEntry.reject(this.error);
					underlayingRootEntry.fulfilled = true;
				}
			} else {
				const { taskWorker } = underlayingRootEntry;
				// taskWorker never fails
				taskWorker.then(() => {
					if (this._status === TaskStatus.Successed) {
						if (!underlayingRootEntry.fulfilled) {
							underlayingRootEntry.resolve(this.result);
							underlayingRootEntry.fulfilled = true;
						}
						return;
					} else {
						if (this._status === TaskStatus.Canceled) {
							if (this._underlayingEntry.error instanceof CancelledError) {
								if (!underlayingRootEntry.fulfilled) {
									underlayingRootEntry.reject(this._underlayingEntry.error);
									underlayingRootEntry.fulfilled = true;
								}
								return;
							} else {
								if (!underlayingRootEntry.fulfilled) {
									underlayingRootEntry.reject(new CancelledError());
									underlayingRootEntry.fulfilled = true;
								}
								return;
							}
						} else if (this._status === TaskStatus.Faulted) {
							if (!underlayingRootEntry.fulfilled) {
								underlayingRootEntry.reject(this.error);
								underlayingRootEntry.fulfilled = true;
							}
							return;
						}
					}
				});
			}
		}

		const subTask: any = super.then(onfulfilled, onrejected);
		subTask._underlayingEntry = this._underlayingEntry;
		return subTask as Task<TResult1>;
	}

	public start(): this {
		if (this._status !== TaskStatus.Created) {
			throw new Error("Invalid operation at current state. The task already started");
		}
		if ((this._underlayingRootEntry as TaskRootEntry<T>).taskWorker !== null) { throw new AssertError("taskWorker !== null"); }

		const taskWorker = Promise.resolve()
			.then(() => {
				return (this._underlayingRootEntry as TaskRootEntry<T>).task(this._underlayingEntry.cancellationToken);
			})
			.then((result) => {
				this._underlayingEntry.result = result;
				this._underlayingEntry.status = TaskStatus.Successed;
			})
			.catch((err) => {
				if (this._underlayingEntry.cancellationToken.isCancellationRequested || err instanceof CancelledError) {
					this._underlayingEntry.status = TaskStatus.Canceled;
					if (err instanceof CancelledError) { this._underlayingEntry.error = err; }
					return;
				}
				this._underlayingEntry.status = TaskStatus.Faulted;
				this._underlayingEntry.error = WrapError.wrapIfNeeded(err);
			});

		(this._underlayingRootEntry as TaskRootEntry<T>).taskWorker = taskWorker;
		this._underlayingEntry.status = TaskStatus.Running;

		return this;
	}

	protected get _status(): TaskStatus {
		return this._underlayingEntry.status;
	}

	// tslint:disable-next-line: max-line-length
	public static create<T>(task: (cancellationToken: contract.CancellationToken) => T | Promise<T>, cancellationToken?: contract.CancellationToken): Task<T> {
		if (cancellationToken === undefined) {
			cancellationToken = DummyCancellationTokenInstance;
		}

		const rootEntry: any = { taskWorker: null, task };
		const entry: TaskEntry<T> = { cancellationToken, status: TaskStatus.Created };

		const executor: PromiseExecutor<T> = (resolve, reject) => {
			rootEntry.resolve = resolve;
			rootEntry.reject = reject;
		};

		const taskInstance = new Task<T>(executor, flagSymbol, rootEntry as TaskRootEntry<T>);
		(taskInstance as any)._underlayingEntry = entry;
		return taskInstance;
	}

	// tslint:disable-next-line: max-line-length
	public static run<T>(task: (cancellationToken: contract.CancellationToken) => T | Promise<T>, cancellationToken?: contract.CancellationToken): Task<T> {
		return Task.create(task, cancellationToken).start();
	}

	public static createCancellationTokenSource(): CancellationTokenSource {
		return new CancellationTokenSourceImpl();
	}

	public static sleep(cancellationToken: contract.CancellationToken): Task<void>;
	public static sleep(ms: number, cancellationToken?: contract.CancellationToken): Task<void>;
	// tslint:disable-next-line: max-line-length
	public static sleep(msOrCancellationToken: number | contract.CancellationToken, cancellationToken?: contract.CancellationToken): Task<void> {
		const [ms, ct] = typeof msOrCancellationToken === "number" ?
			[msOrCancellationToken, cancellationToken] : [undefined, msOrCancellationToken];
		function worker(token: contract.CancellationToken) {
			return new Promise<void>((resolve, reject) => {
				if (token.isCancellationRequested) {
					return reject(new CancelledError());
				}

				let timeout: number | undefined = undefined;
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

	// tslint:disable:max-line-length
	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7, T8, T9>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>, task5: Task<T5>, task6: Task<T6>, task7: Task<T7>, task8: Task<T8>, task9: Task<T9>): contract.Task<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7, T8>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>, task5: Task<T5>, task6: Task<T6>, task7: Task<T7>, task8: Task<T8>): contract.Task<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>, task5: Task<T5>, task6: Task<T6>, task7: Task<T7>): contract.Task<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>, task5: Task<T5>, task6: Task<T6>): contract.Task<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>, task5: Task<T5>): contract.Task<void>;
	public static waitAll<T0, T1, T2, T3, T4>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>): contract.Task<void>;
	// tslint:enable:max-line-length
	public static waitAll<T0, T1, T2, T3>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>): contract.Task<void>;
	public static waitAll<T0, T1, T2>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>): contract.Task<void>;
	public static waitAll<T0, T1>(task0: Task<T0>, task1: Task<T1>): contract.Task<void>;
	public static waitAll<T>(task0: Task<T>): contract.Task<void>;
	public static waitAll(tasks: Task<any>[]): contract.Task<void>;
	public static waitAll(...tasks: Task<any>[]): contract.Task<void>;
	public static waitAll(...tasks: any): contract.Task<void> {
		if (!tasks) { throw new Error("Wrong arguments"); }
		return Task.create<void>(async () => {
			if (tasks.length === 0) { return Promise.resolve(); }
			if (tasks.length === 1) {
				if (Array.isArray(tasks[0])) {
					tasks = tasks[0];
				}
			}
			await Promise.all(tasks.map((task: any) => {
				if (task._status === TaskStatus.Created) { task.start(); }
				if (task._underlayingRootEntry.taskWorker === null) { throw new AssertError("Task worker not exist after start"); }
				return task._underlayingRootEntry.taskWorker;
			})); // Should never failed
			let errors: Array<Error> = [];
			for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
				const task = tasks[taskIndex];
				if (task._status === TaskStatus.Successed) {
					continue;
				}
				if (task._status === TaskStatus.Faulted) {
					errors.push(task.error);
				} else if (task._status === TaskStatus.Canceled) {
					errors.push(new CancelledError());
				} else {
					// Should never happened
					throw new AssertError("Wrong task status. Should never happened");
				}
			}
			if (errors.length > 0) {
				throw new AggregateError(errors);
			}
		});
	}
}
