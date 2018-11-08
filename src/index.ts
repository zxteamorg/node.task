const enum TaskStatus {
	Running = 3,
	Completed = 5,
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

export class Task<T> {
	private readonly _promise: Promise<void>;
	private _result: T | undefined;
	private _error: Error | undefined;
	private _status: TaskStatus;
	public constructor(
		task: ((cancellationToken: CancellationToken) => T | Promise<T>) | Promise<T>,
		cancellationToken?: CancellationToken
	) {
		this._result = undefined;
		this._error = undefined;
		this._status = TaskStatus.Running;
		const taskCancellationToken = cancellationToken || DummyCancellationTokenInstance;
		const initPromise: Promise<T> = (task instanceof Promise) ?
			task :
			new Promise((resolve, reject) => {
				try { resolve(task(taskCancellationToken)); } catch (e) { reject(e); }
			});
		this._promise = initPromise
			.then((result: T) => {
				this._result = result;
				this._status = TaskStatus.Completed;
			})
			.catch(reason => {
				if (taskCancellationToken.isCancellationRequested || reason instanceof CancelledError) {
					this._status = TaskStatus.Canceled;
					this._error = reason;
					return;
				}
				this._status = TaskStatus.Faulted;
				this._error = WrapError.wrapIfNeeded(reason);
			});
	}

	public get result(): T {
		if (typeof this._result !== "undefined") { return this._result; }
		throw new Error("Invalid operation. A task does not have result.");
	}

	public get isCompleted(): boolean {
		return this._status === TaskStatus.Completed || this.isFaulted || this.isCancelled;
	}
	public get isFaulted(): boolean {
		return this._status === TaskStatus.Faulted;
	}
	public get isCancelled(): boolean {
		return this._status === TaskStatus.Canceled;
	}

	public async wait(): Promise<void> {
		await this._promise; // Never failed
		if (typeof this._error !== "undefined") { throw this._error; }
	}

	public static createCancellationTokenSource(): CancellationTokenSource {
		return new CancellationTokenSourceImpl();
	}

	public static sleep(ms: number, cancellationToken?: CancellationToken): Task<void> {
		function worker(token: CancellationToken) {
			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(function () {
					token.removeCancelListener(cancelCallback);
					resolve();
				}, ms);
				function cancelCallback() {
					token.removeCancelListener(cancelCallback);
					clearTimeout(timeout);
					reject(new CancelledError());
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
		await Promise.all(tasks.map(task => task._promise)); // Never failed
		let errors: Array<Error> = [];
		for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
			const task = tasks[taskIndex];
			if (typeof task._error !== "undefined") {
				errors.push(task._error);
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
