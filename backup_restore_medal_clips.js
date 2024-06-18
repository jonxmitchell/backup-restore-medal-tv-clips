const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const readline = require("readline");
const { exec } = require("child_process");

// Dynamically import pretty-bytes
let prettyBytes;

(async () => {
	prettyBytes = (await import("pretty-bytes")).default;

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const config = require("./config.json");

	const defaultDirectoriesToBackup = [
		".Thumbnails",
		"Clips",
		"editor",
		"Edits",
		"Screenshots",
	];

	function ensureDirectoryExistence(dir) {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}

	const getUserInput = (question) => {
		return new Promise((resolve) => {
			rl.question(question, (answer) => {
				resolve(answer);
			});
		});
	};

	const backupClips = async () => {
		if (!config.medalClipsPath) {
			const manualPath = await getUserInput(
				"Please enter the Medal clips directory path: "
			);
			config.medalClipsPath = manualPath.trim();
		}

		if (!config.backupDir) {
			const manualBackupPath = await getUserInput(
				"Please enter the backup directory path: "
			);
			config.backupDir = manualBackupPath.trim();
		}

		const directoriesToBackup = [
			...defaultDirectoriesToBackup,
			...(config.directoriesToBackup || []),
		];

		const medalClipsPath = path.resolve(config.medalClipsPath);
		const backupDir = path.resolve(config.backupDir);

		ensureDirectoryExistence(backupDir);

		const currentTime = new Date().toISOString().replace(/[:.-]/g, "_");
		const backupZipFilename = `Medal_Backup_${currentTime}.zip`;
		const backupZipPath = path.join(backupDir, backupZipFilename);

		const output = fs.createWriteStream(backupZipPath);
		const archive = archiver("zip", {
			zlib: { level: 9 },
		});

		let totalFiles = 0;
		let totalSize = 0;

		const startTime = Date.now();

		output.on("close", function () {
			const endTime = Date.now();
			const duration = (endTime - startTime) / 1000;
			console.log(
				`Backup completed successfully. The backup file is located at: ${backupZipPath}`
			);
			console.log(`Total files: ${totalFiles}`);
			console.log(`Total size: ${prettyBytes(totalSize || 0)}`);
			console.log(`Total time: ${duration} seconds`);
			process.exit(0);
		});

		output.on("error", function (err) {
			console.error(`Error: ${err.message}`);
			process.exit(1);
		});

		archive.on("error", function (err) {
			console.error(`Error: ${err.message}`);
			process.exit(1);
		});

		archive.on("entry", function (entry) {
			totalFiles++;
			totalSize += entry.stats.size || 0;
			console.log(`Backing up: ${entry.name}`);
		});

		archive.pipe(output);

		directoriesToBackup.forEach((dir) => {
			const fullPath = path.join(medalClipsPath, dir);
			if (fs.existsSync(fullPath)) {
				archive.directory(fullPath, dir);
			} else {
				console.warn(
					`Warning: The directory ${fullPath} does not exist and will be skipped.`
				);
			}
		});

		archive
			.finalize()
			.then(() => {
				console.log(
					"Archive has been finalized and the output file descriptor has closed."
				);
			})
			.catch((err) => {
				console.error(`Error finalizing archive: ${err.message}`);
				process.exit(1);
			});
	};

	const mode = await getUserInput(
		"Do you want to (1) backup or (2) restore? (Enter 1 or 2): "
	);

	if (mode === "1") {
		await backupClips();
	} else {
		console.error("Invalid choice. Exiting.");
		process.exit(1);
	}

	rl.close();
})();
