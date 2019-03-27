import * as contract from "@zxteam/contract";

const enum TaskStatus {
	Created = 0,
	Running = 3,
	Successed = 5,
	Canceled = 6,
	Faulted = 7
}

class DummyCancellationTokenImpl implements contract.CancellationToken {
	public get isCancellationRequested(): boolean { return false; }
	public addCancelListener(cb: Function): void {/* Dummy */ }
	public removeCancelListener(cb: Function): void {/* Dummy */ }
	public throwIfCancellationRequested(): void {/* Dummy */ }
}

export const DUMMY_CANCELLATION_TOKEN = new DummyCancellationTokenImpl();

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
			// Release callback. We do not need its anymore
			const cancelListeners = this._cancelListeners.splice(0);
			cancelListeners.forEach(cancelListener => {
				try {
					cancelListener();
				} catch (e) {
					errors.push(WrapError.wrapIfNeeded(e));
				}
			});
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

class AssertError extends Error {
	public readonly name: "AssertError";
}

export class WrapError extends Error {
	public readonly name: "WrapError";
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
}
interface TaskEntry<T> {
	readonly cancellationToken: contract.CancellationToken;
	result?: T;
	error?: Error;
	status: TaskStatus;
	taskWorker: Promise<void> | null;
}

const flagSymbol: Symbol = Symbol();

export type PromiseExecutor<T> = (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void;

export class Task<T> extends Promise<T> implements contract.Task<T> {
	private readonly _underlayingRootEntry?: TaskRootEntry<T>;
	private readonly _underlayingEntry: TaskEntry<T>;

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

	public then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Task<TResult1 | TResult2> {
		const underlayingRootEntry = this._underlayingRootEntry;

		if (underlayingRootEntry !== undefined) {
			if (this._status === TaskStatus.Created) { this.start(); }
			const { taskWorker } = this._underlayingEntry;
			if (taskWorker === null) { throw new AssertError(); }

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
		return subTask as Task<TResult1 | TResult2>;
	}

	public catch<TResult = never>(onrejected?: ((reason: Error) => TResult | PromiseLike<TResult>) | undefined | null): Task<T | TResult> {
		return super.catch(onrejected) as Task<T | TResult>;
	}

	public start(): this {
		if (this._status !== TaskStatus.Created) {
			throw new Error("Invalid operation at current state. The task already started");
		}
		if (this._underlayingEntry.taskWorker !== null) { throw new AssertError("taskWorker !== null"); }

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

		this._underlayingEntry.taskWorker = taskWorker;
		this._underlayingEntry.status = TaskStatus.Running;

		return this;
	}

	public wait(): Promise<void> {
		const taskWorker = this._underlayingEntry.taskWorker;
		return taskWorker !== null ? taskWorker : Promise.resolve();
	}

	protected get _status(): TaskStatus {
		return this._underlayingEntry.status;
	}

	public static create<T = void>(task: (cancellationToken: contract.CancellationToken) => T | Promise<T>, cancellationToken?: contract.CancellationToken): Task<T> {
		if (cancellationToken === undefined) {
			cancellationToken = DUMMY_CANCELLATION_TOKEN;
		}

		const rootEntry: any = { taskWorker: null, task };
		const entry: TaskEntry<T> = { cancellationToken, status: TaskStatus.Created, taskWorker: null };

		const executor: PromiseExecutor<T> = (resolve, reject) => {
			rootEntry.resolve = resolve;
			rootEntry.reject = reject;
		};

		const taskInstance = new Task<T>(executor, flagSymbol, rootEntry as TaskRootEntry<T>);
		(taskInstance as any)._underlayingEntry = entry;
		return taskInstance;
	}

	public static reject<T = never>(reason: Error): Task<T> {
		return Task.run(() => Promise.reject(reason));
	}

	public static resolve(): Task<void>;
	public static resolve<T = void>(value: T | PromiseLike<T>): Task<T>;
	public static resolve<T>(value?: T | PromiseLike<T>): Task<T> | Task<void> {
		if (value !== undefined) {
			return Task.run(() => Promise.resolve(value));
		} else {
			return Task.run(() => Promise.resolve());
		}
	}

	public static run<T = void>(task: (cancellationToken: contract.CancellationToken) => T | Promise<T>, cancellationToken?: contract.CancellationToken): Task<T> {
		return Task.create(task, cancellationToken).start();
	}

	public static createCancellationTokenSource(): CancellationTokenSource {
		return new CancellationTokenSourceImpl();
	}

	public static sleep(cancellationToken: contract.CancellationToken): Task<void>;
	public static sleep(ms: number, cancellationToken?: contract.CancellationToken): Task<void>;
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

	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7, T8, T9>(task0: contract.Task<T0>, task1: contract.Task<T1>, task2: contract.Task<T2>, task3: contract.Task<T3>, task4: contract.Task<T4>, task5: contract.Task<T5>, task6: contract.Task<T6>, task7: contract.Task<T7>, task8: contract.Task<T8>, task9: contract.Task<T9>): Task<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7, T8>(task0: contract.Task<T0>, task1: contract.Task<T1>, task2: contract.Task<T2>, task3: contract.Task<T3>, task4: contract.Task<T4>, task5: contract.Task<T5>, task6: contract.Task<T6>, task7: contract.Task<T7>, task8: contract.Task<T8>): Task<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7>(task0: contract.Task<T0>, task1: contract.Task<T1>, task2: contract.Task<T2>, task3: contract.Task<T3>, task4: contract.Task<T4>, task5: contract.Task<T5>, task6: Task<T6>, task7: contract.Task<T7>): Task<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6>(task0: contract.Task<T0>, task1: contract.Task<T1>, task2: contract.Task<T2>, task3: contract.Task<T3>, task4: contract.Task<T4>, task5: contract.Task<T5>, task6: contract.Task<T6>): Task<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5>(task0: contract.Task<T0>, task1: contract.Task<T1>, task2: contract.Task<T2>, task3: contract.Task<T3>, task4: contract.Task<T4>, task5: contract.Task<T5>): Task<void>;
	public static waitAll<T0, T1, T2, T3, T4>(task0: contract.Task<T0>, task1: contract.Task<T1>, task2: contract.Task<T2>, task3: contract.Task<T3>, task4: contract.Task<T4>): Task<void>;
	public static waitAll<T0, T1, T2, T3>(task0: contract.Task<T0>, task1: contract.Task<T1>, task2: contract.Task<T2>, task3: contract.Task<T3>): Task<void>;
	public static waitAll<T0, T1, T2>(task0: contract.Task<T0>, task1: contract.Task<T1>, task2: contract.Task<T2>): Task<void>;
	public static waitAll<T0, T1>(task0: contract.Task<T0>, task1: contract.Task<T1>): Task<void>;
	public static waitAll<T>(task0: contract.Task<T>): Task<void>;
	public static waitAll(tasks: contract.Task<any>[]): Task<void>;
	public static waitAll(...tasks: contract.Task<any>[]): Task<void>;
	public static waitAll(...tasks: any): Task<void> {
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
				if (task._underlayingEntry.taskWorker === null) { throw new AssertError("Task worker not exist after start"); }
				return task._underlayingEntry.taskWorker;
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
