import { assert } from "chai";

import { Task, AggregateError, CancelledError, WrapError, CancellationTokenLike } from "../src/index";


describe("0.0.1", () => {
	it("Should cancel two listeners", async () => {
		let cancel1 = false;
		let cancel2 = false;

		const cts = Task.createCancellationTokenSource();

		const defer: any = {};
		defer.promise = new Promise(resolve => { defer.resolve = resolve; });

		const task = new Task(
			async (ct: CancellationTokenLike): Promise<void> => {

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
