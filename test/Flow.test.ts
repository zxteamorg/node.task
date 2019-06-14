import * as zxteam from "@zxteam/contract";

import { assert } from "chai";

import { Task } from "../src/index";

describe("Flow tests", function () {
	it("Common flow", async function () {
		const flowTask = Task
			.create(() => {
				console.log("Flow setup: Turn on loading screen...");
			})
			.continue(Task
				.create(() => {
					return Task.waitAll(
						Task.sleep(5).continue(Task.resolve(1)),
						Task.sleep(100).continue(Task.resolve(41))
					).continue((prevTask) => {
						if (prevTask.isSuccessed) {
							const [a, b] = prevTask.result;
							console.log("Flow set amount ", a + b);
							return Promise.resolve(a + b);
						}
						throw prevTask.error;
					}).continue((prevTask) => {
						return prevTask.result;
					});
				})
				.continue((prevTask) => {
					return prevTask;
				})
				.continue((parent) => {
					if (parent.isSuccessed) {
						console.log("Flow setup: Turn off loading screen...");
					} else {
						console.log("Flow crash: Turn off loading screen...");
					}
					return parent;
				})
			).continue((prev) => {
				console.log("Flow Exit");
				return prev;
			});

		const flowResult = await flowTask.promise;

		assert.equal(flowResult, 42);
	});
});
