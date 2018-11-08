export class AssertError extends Error {
}

export class WrapError extends Error {
	public readonly wrap: any;
	public constructor(wrap: any) {
		super(wrap && wrap.toString());
		this.wrap = wrap;
	}
}

export class CanceledError extends Error {
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
	onCancel(cb: Function): void;
	throwIfCancellationRequested(): void;
}

export interface CancellationTokenSource {
	readonly isCancellationRequested: boolean;
	readonly token: CancellationToken;
	cancel(): void;
}

export class Task<T> {
	private readonly _promise: Promise<void>;
	private readonly _cancellationToken: CancellationToken | null;
	private _result: T | undefined;
	private _error: Error | undefined;
	private _status: TaskStatus;
	public constructor(task: () => T | Promise<T>, cancellationToken?: CancellationToken) {
		this._result = undefined;
		this._error = undefined;
		this._status = TaskStatus.Running;
		this._cancellationToken = cancellationToken || null;
		this._promise = new Promise((resolve, reject) => {
			try { resolve(task()); } catch (e) { reject(e); }
		})
			.then((result: T) => {
				this._result = result;
				this._status = TaskStatus.Completed;
			})
			.catch(reason => {
				if (reason instanceof CanceledError) {
					this._status = TaskStatus.Canceled;
					return;
				}
				this._status = TaskStatus.Faulted;
				if (reason instanceof Error) {
					this._error = reason;
				} else {
					this._error = new WrapError(reason);
				}
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
		if (this.isFaulted) { throw this._error; }
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
			if (task.isCancelled) { throw new CanceledError(); }
			if (task.isFaulted) {
				if (typeof task._error === "undefined") {
					// Never happened
					throw new AssertError();
				}
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

const enum TaskStatus {
	Running = 3,
	Completed = 5,
	Canceled = 6,
	Faulted = 7
}

// namespace taskImpl {


// 	class CancelationTokenSource implements task.CancellationTokenSource {
// 		public readonly token: task.CancellationToken;
// 		private _isCancellationRequested: boolean;

// 		public constructor() {
// 			const self = this;
// 			this.token = {
// 				get isCancellationRequested() { return self.isCancellationRequested; },
// 				onCancel(cb) { return self.onCancel(cb); },
// 				throwIfCancellationRequested() { return self.throwIfCancellationRequested(); }
// 			};
// 			this._isCancellationRequested = false;
// 		}

// 		public cancel(): void {
// 			this._isCancellationRequested = true;
// 			// TODO call callbacks
// 		}
// 		public get isCancellationRequested(): boolean {
// 			return this._isCancellationRequested;
// 		}

// 		private onCancel(cb: Function): void {
// 			//
// 		}
// 		private throwIfCancellationRequested(): void {
// 			if (this.isCancellationRequested) {
// 				throw new OperationCanceledError();
// 			}
// 		}
// 	}
// }
