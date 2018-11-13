const enum TaskStatus {
	Created = 0,
	Running = 3,
	CompletedSuccessfully = 5,
	Canceled = 6,
	Faulted = 7
}

class DummyCancellationToken implements CancellationToken {
	public get isCancellationRequested(): boolean { return false; }
	public addCancelListener(cb: Function): void {/* Dummy */ }
	public removeCancelListener(cb: Function): void {/* Dummy */ }
	public throwIfCancellationRequested(): void {/* Dummy */ }
}
class CancellationTokenSourceImpl implements CancellationTokenSource {
	public readonly token: CancellationToken;
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
		this._cancelListeners.forEach(cancelListener => {
			try {
				cancelListener();
			} catch (e) {
				errors.push(WrapError.wrapIfNeeded(e));
			}
		});
		if (errors.length > 0) {
			throw new AggregateError(errors);
		}
	}

	private addCancelListener(cb: Function): void { this._cancelListeners.push(cb); }
	private removeCancelListener(cb: Function): void {
		const cbIndex = this._cancelListeners.indexOf(cb);
		if (cbIndex !== -1) { this._cancelListeners.splice(cbIndex, 1); }
	}
	private throwIfCancellationRequested(): void {
		if (this.isCancellationRequested) { throw new CancelledError(); }
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

export class CancelledError extends Error {
}

export class AggregateError extends Error {
	public readonly innerError: Error;
	public readonly innerErrors: Array<Error>;
	public constructor(innerErrors: Array<Error>) {
		if (innerErrors.length === 0) { throw new AssertError(); }
		super(innerErrors[0].message);
		this.innerError = innerErrors[0];
		this.innerErrors = innerErrors;
	}
}

export interface CancellationToken {
	readonly isCancellationRequested: boolean;
	addCancelListener(cb: Function): void;
	removeCancelListener(cb: Function): void;
	throwIfCancellationRequested(): void;
}

export interface CancellationTokenSource {
	readonly isCancellationRequested: boolean;
	readonly token: CancellationToken;
	cancel(): void;
}

export class Task<T> implements PromiseLike<T> {
	private readonly _task: (cancellationToken: CancellationToken) => T | Promise<T>;
	private readonly _cancellationToken: CancellationToken;
	private _taskWorker: Promise<void> | null;
	private _result: T;
	private _error: Error;
	private _status: TaskStatus;

	public constructor(
		task: (cancellationToken: CancellationToken) => T | Promise<T>,
		cancellationToken?: CancellationToken
	) {
		this._task = task;
		this._cancellationToken = cancellationToken || DummyCancellationTokenInstance;

		this._taskWorker = null;
		this._status = TaskStatus.Created;
	}

	public get error(): Error {
		if (this._status === TaskStatus.Faulted) {
			return this._error;
		}
		throw new Error("Invalid operation at current state");
	}
	public get result(): T {
		if (this._status === TaskStatus.CompletedSuccessfully) { return this._result; }
		throw new Error("Invalid operation at current state");
	}

	public get isCompleted(): boolean {
		return this._status === TaskStatus.CompletedSuccessfully || this.isFaulted || this.isCancelled;
	}
	public get isCompletedSuccessfully(): boolean {
		return this._status === TaskStatus.CompletedSuccessfully;
	}
	public get isFaulted(): boolean {
		return this._status === TaskStatus.Faulted;
	}
	public get isCancelled(): boolean {
		return this._status === TaskStatus.Canceled;
	}

	public async then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): Promise<TResult1 | TResult2> {
		if (this._status === TaskStatus.Created) { this.start(); }
		if (this._taskWorker === null) { throw new AssertError(); }

		if (onfulfilled && (this._status === TaskStatus.CompletedSuccessfully)) { return onfulfilled(this.result); }
		if (onrejected && (this._status === TaskStatus.Faulted || this._status === TaskStatus.Canceled)) { return onrejected(this._error); }

		let resultPromise: any = this._taskWorker; // _taskWorker never fails
		if (onfulfilled || onrejected) {
			resultPromise = resultPromise.then(() => {
				if (this._status === TaskStatus.CompletedSuccessfully) {
					if (onfulfilled) { return onfulfilled(this.result); }
					return this.result;
				} else {
					if (this._status === TaskStatus.Canceled) {
						if (this._error instanceof CancelledError) {
							if (onrejected) { return onrejected(this._error); }
							throw this._error;
						} else {
							if (onrejected) { return onrejected(new CancelledError()); }
							throw new CancelledError();
						}
					} else if (this._status === TaskStatus.Faulted) {
						if (onrejected) { return onrejected(this.error); }
						throw this.error;
					}
				}
			});
		}
		return resultPromise;
	}

	public catch<TResult = never>(
		onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
	): Promise<T | TResult> {
		return this.then(undefined, onrejected);
	}

	public start(): this {
		if (this._status !== TaskStatus.Created) { throw new Error("Invalid operation at current state. The task already started"); }
		if (this._taskWorker !== null) { throw new AssertError("this._taskWorker !== null"); }
		const taskWorker = Promise.resolve()
			.then(() => this._task(this._cancellationToken))
			.then((result) => {
				this._result = result;
				this._status = TaskStatus.CompletedSuccessfully;
			})
			.catch((err) => {
				if (this._cancellationToken.isCancellationRequested || err instanceof CancelledError) {
					this._status = TaskStatus.Canceled;
					if (err instanceof CancelledError) { this._error = err; }
					return;
				}
				this._status = TaskStatus.Faulted;
				this._error = WrapError.wrapIfNeeded(err);
			});

		this._taskWorker = taskWorker;
		this._status = TaskStatus.Running;
		return this;
	}

	public static createCancellationTokenSource(): CancellationTokenSource {
		return new CancellationTokenSourceImpl();
	}

	public static sleep(ms: number, cancellationToken?: CancellationToken): Task<void> {
		function worker(token: CancellationToken) {
			return new Promise<void>((resolve, reject) => {
				if (token.isCancellationRequested) {
					return reject(new CancelledError());
				}
				const timeout = setTimeout(function () {
					token.removeCancelListener(cancelCallback);
					return resolve();
				}, ms);
				function cancelCallback() {
					token.removeCancelListener(cancelCallback);
					clearTimeout(timeout);
					return reject(new CancelledError());
				}
				token.addCancelListener(cancelCallback);
			});
		}

		return new Task(worker, cancellationToken);
	}

	// tslint:disable:max-line-length
	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7, T8, T9>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>, task5: Task<T5>, task6: Task<T6>, task7: Task<T7>, task8: Task<T8>, task9: Task<T9>): Promise<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7, T8>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>, task5: Task<T5>, task6: Task<T6>, task7: Task<T7>, task8: Task<T8>): Promise<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6, T7>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>, task5: Task<T5>, task6: Task<T6>, task7: Task<T7>): Promise<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5, T6>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>, task5: Task<T5>, task6: Task<T6>): Promise<void>;
	public static waitAll<T0, T1, T2, T3, T4, T5>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>, task5: Task<T5>): Promise<void>;
	public static waitAll<T0, T1, T2, T3, T4>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>, task4: Task<T4>): Promise<void>;
	// tslint:enable:max-line-length
	public static waitAll<T0, T1, T2, T3>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>, task3: Task<T3>): Promise<void>;
	public static waitAll<T0, T1, T2>(task0: Task<T0>, task1: Task<T1>, task2: Task<T2>): Promise<void>;
	public static waitAll<T0, T1>(task0: Task<T0>, task1: Task<T1>): Promise<void>;
	public static waitAll<T>(task0: Task<T>): Promise<void>;
	public static async waitAll(...tasks: Array<Task<any>>): Promise<void> {
		await Promise.all(tasks.map(task => {
			if (task._status === TaskStatus.Created) { task.start(); }
			if (task._taskWorker === null) { throw new AssertError("Task worker not exist after start"); }
			return task._taskWorker;
		})); // Should never failed
		let errors: Array<Error> = [];
		for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
			const task = tasks[taskIndex];
			if (task._status === TaskStatus.CompletedSuccessfully) {
				continue;
			}
			if (task._status === TaskStatus.Faulted) {
				errors.push(task.error);
			} else if (task._status === TaskStatus.Canceled) {
				errors.push(new CancelledError());
			} else {
				// Should never happened
				throw new AssertError("Wrong task status");
			}
		}
		if (errors.length > 0) {
			if (errors.length > 1) {
				throw new AggregateError(errors);
			} else {
				throw errors[0];
			}
		}
	}
}

export default Task;
