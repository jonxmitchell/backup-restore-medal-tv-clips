const fs = require("fs");
const path = require("path");
const readline = require("readline");

const config = require("./config.json");

// Create readline interface
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const getUserInput = (question) => {
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			resolve(answer);
		});
	});
};

(async () => {
	// Prompt user for input
	const medalClipsPath = await getUserInput(
		"Please enter the Medal clips directory path: "
	);
	console.log(`Medal clips directory path: ${medalClipsPath}`);
	rl.close();
})();
