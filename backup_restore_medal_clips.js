const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const readline = require("readline");
const { exec } = require("child_process");
const extract = require("extract-zip");

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

	const directoriesToBackup = [
		...defaultDirectoriesToBackup,
		...(config.directoriesToBackup || []),
	];

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

	const restoreClips = async () => {
		const backupZipPath = await getUserInput(
			"Please enter the path to the backup ZIP file: "
		);

		const absoluteBackupZipPath = path.resolve(backupZipPath);

		const extractPath = path.join(config.backupDir, "temp_restore");
		const absoluteExtractPath = path.resolve(extractPath);

		try {
			await extract(absoluteBackupZipPath, { dir: absoluteExtractPath });
			console.log(`Extracted backup to ${absoluteExtractPath}`);
		} catch (err) {
			console.error(`Error extracting backup: ${err.message}`);
			process.exit(1);
		}

		const medaldirJsonPath = path.join(absoluteExtractPath, "medaldir.json");
		let originalMedalDir;
		try {
			const medaldirJsonContent = fs.readFileSync(medaldirJsonPath, "utf-8");
			const medaldirJson = JSON.parse(medaldirJsonContent);
			originalMedalDir = medaldirJson.medalDir;
		} catch (err) {
			console.error(`Error reading medaldir.json: ${err.message}`);
			process.exit(1);
		}

		const clipsJsonPath = path.join(
			process.env.APPDATA,
			"Medal",
			"store",
			"clips.json"
		);

		try {
			fs.copyFileSync(
				path.join(absoluteExtractPath, "clips.json"),
				clipsJsonPath
			);
			console.log(`Restored clips.json to ${clipsJsonPath}`);
		} catch (err) {
			console.error(`Error restoring clips.json: ${err.message}`);
			process.exit(1);
		}

		directoriesToBackup.forEach((dir) => {
			const srcDir = path.join(absoluteExtractPath, dir);
			const destDir = path.join(originalMedalDir, dir);
			if (fs.existsSync(srcDir)) {
				ensureDirectoryExistence(destDir);
				fs.cpSync(srcDir, destDir, { recursive: true });
				console.log(`Restored ${dir} to ${destDir}`);
			} else {
				console.warn(
					`Warning: The directory ${srcDir} does not exist and will be skipped.`
				);
			}
		});

		console.log("Restore completed successfully.");
		process.exit(0);
	};

	const mode = await getUserInput(
		"Do you want to (1) backup or (2) restore? (Enter 1 or 2): "
	);

	if (mode === "1") {
		await backupClips();
	} else if (mode === "2") {
		await restoreClips();
	} else {
		console.error("Invalid choice. Exiting.");
		process.exit(1);
	}

	rl.close();
})();
