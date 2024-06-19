const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const readline = require("readline");
const { exec } = require("child_process");
const extract = require("extract-zip");
const { performance } = require("perf_hooks");

// Dynamically import pretty-bytes and chalk
let prettyBytes, chalk;

(async () => {
	prettyBytes = (await import("pretty-bytes")).default;
	chalk = (await import("chalk")).default;

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

	function getDrives() {
		return new Promise((resolve, reject) => {
			exec("wmic logicaldisk get name", (error, stdout, stderr) => {
				if (error) {
					reject(error);
				} else {
					const drives = stdout
						.split("\r\n")
						.filter((line) => /^[A-Za-z]:/.test(line))
						.map((line) => line.trim());
					resolve(drives);
				}
			});
		});
	}

	async function scanForMedalDir() {
		const drives = await getDrives();
		const foundDirectories = [];

		const userProfile = process.env.USERPROFILE || process.env.HOME;
		const commonDirs = [
			userProfile,
			path.join(userProfile, "Documents"),
			path.join(userProfile, "Downloads"),
			path.join(userProfile, "Desktop"),
		];

		for (const dir of commonDirs) {
			const searchCommand = `powershell -Command "Get-ChildItem -Path '${dir}' -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Medal' } | Select-Object -ExpandProperty FullName"`;
			try {
				const result = await new Promise((resolve, reject) => {
					exec(searchCommand, (error, stdout, stderr) => {
						if (error) {
							reject(error);
						} else {
							const directories = stdout
								.trim()
								.split("\n")
								.map((dir) => dir.trim());
							resolve(directories);
						}
					});
				});
				foundDirectories.push(...result);
			} catch (error) {
				console.warn(`Error scanning directory ${dir}: ${error.message}`);
			}
		}

		for (const drive of drives) {
			const searchCommand = `powershell -Command "Get-ChildItem -Path ${drive} -Recurse -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Medal' } | Select-Object -ExpandProperty FullName"`;
			try {
				const result = await new Promise((resolve, reject) => {
					exec(searchCommand, (error, stdout, stderr) => {
						if (error) {
							reject(error);
						} else {
							const directories = stdout
								.trim()
								.split("\n")
								.map((dir) => dir.trim());
							resolve(directories);
						}
					});
				});
				foundDirectories.push(...result);
			} catch (error) {
				console.warn(`Error scanning drive ${drive}: ${error.message}`);
			}
		}

		return foundDirectories.filter((dir) => dir);
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
			const userChoice = await getUserInput(
				"Medal clips path is empty. Do you want to (1) manually enter the directory or (2) scan your PC for the /Medal directory? (Enter 1 or 2): "
			);
			if (userChoice === "1") {
				const manualPath = await getUserInput(
					"Please enter the Medal clips directory path: "
				);
				config.medalClipsPath = manualPath.trim();
			} else if (userChoice === "2") {
				console.log("Scanning your PC for the /Medal directory...");
				try {
					const foundDirectories = await scanForMedalDir();
					if (foundDirectories.length > 0) {
						console.log("Found the following Medal clips directories:");
						foundDirectories.forEach((dir, index) => {
							console.log(`${index + 1}: ${dir}`);
						});
						const dirChoice = await getUserInput(
							"Please select the directory number you want to use: "
						);
						const selectedDir = foundDirectories[parseInt(dirChoice) - 1];
						if (selectedDir) {
							config.medalClipsPath = selectedDir.trim();
						} else {
							console.error("Invalid selection. Exiting.");
							process.exit(1);
						}
					} else {
						console.error("No Medal clips directories found. Exiting.");
						process.exit(1);
					}
				} catch (error) {
					console.error(`Error scanning for directories: ${error.message}`);
					process.exit(1);
				}
			} else {
				console.error("Invalid choice. Exiting.");
				process.exit(1);
			}
		}

		if (!config.backupDir) {
			const userChoice = await getUserInput(
				"Backup directory is empty. Do you want to (1) manually enter the backup directory or (2) use the default Backups directory? (Enter 1 or 2): "
			);
			if (userChoice === "1") {
				const manualBackupPath = await getUserInput(
					"Please enter the backup directory path: "
				);
				config.backupDir = manualBackupPath.trim();
			} else if (userChoice === "2") {
				const scriptRoot = path.dirname(require.main.filename);
				const defaultBackupDir = path.join(scriptRoot, "Backups");
				ensureDirectoryExistence(defaultBackupDir);
				config.backupDir = defaultBackupDir;
			} else {
				console.error("Invalid choice. Exiting.");
				process.exit(1);
			}
		}

		const medalClipsPath = path.resolve(config.medalClipsPath);
		const backupDir = path.resolve(config.backupDir);

		const clipsJsonPath = path.join(
			process.env.APPDATA,
			"Medal",
			"store",
			"clips.json"
		);

		const medaldirJsonContent = JSON.stringify({ medalDir: medalClipsPath });

		rl.close();

		if (!fs.existsSync(medalClipsPath)) {
			console.error(`Error: The directory ${medalClipsPath} does not exist.`);
			process.exit(1);
		}

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
				`${chalk.cyan(
					"Backup completed successfully. The backup file is located at:"
				)} ${chalk.magenta(backupZipPath)}`
			);
			console.log(`${chalk.cyan("Total files:")} ${chalk.magenta(totalFiles)}`);
			console.log(
				`${chalk.cyan("Total size:")} ${chalk.magenta(
					prettyBytes(totalSize || 0)
				)}`
			);
			console.log(
				`${chalk.cyan("Total time:")} ${chalk.magenta(
					`${duration.toFixed(3)} seconds`
				)}`
			);
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

		archive.pipe(output);

		const addFileToArchive = (fullPath, relativePath) => {
			return new Promise((resolve, reject) => {
				const startEntryTime = performance.now();
				const fileSize = fs.statSync(fullPath).size || 0;
				const fileStream = fs.createReadStream(fullPath);
				fileStream.on("error", (err) => {
					console.error(`Error reading file ${relativePath}: ${err.message}`);
					reject(err);
				});
				archive.append(fileStream, { name: relativePath });
				fileStream.on("end", () => {
					const endEntryTime = performance.now();
					const duration = endEntryTime - startEntryTime;
					console.log(
						`${chalk.blue("Backing up:")} ${chalk.green(
							relativePath
						)} ${chalk.red(
							`(${duration.toFixed(2)} ms - ${prettyBytes(fileSize)})`
						)}`
					);
					totalFiles++;
					totalSize += fileSize;
					resolve();
				});
			});
		};

		const addFilesToArchive = async (directoryPath, basePath) => {
			const items = fs.readdirSync(directoryPath);
			for (const item of items) {
				const fullPath = path.join(directoryPath, item);
				const relativePath = path.relative(basePath, fullPath);

				if (fs.statSync(fullPath).isDirectory()) {
					await addFilesToArchive(fullPath, basePath);
				} else {
					await addFileToArchive(fullPath, relativePath);
				}
			}
		};

		try {
			for (const dir of directoriesToBackup) {
				const fullPath = path.join(medalClipsPath, dir);
				if (fs.existsSync(fullPath)) {
					await addFilesToArchive(fullPath, medalClipsPath);
				} else {
					console.warn(
						`Warning: The directory ${fullPath} does not exist and will be skipped.`
					);
				}
			}

			if (fs.existsSync(clipsJsonPath)) {
				await addFileToArchive(clipsJsonPath, "clips.json");
			} else {
				console.warn(
					`Warning: The file ${clipsJsonPath} does not exist and will be skipped.`
				);
			}

			archive.append(medaldirJsonContent, { name: "medaldir.json" });

			await archive.finalize();
		} catch (err) {
			console.error(`Error during backup: ${err.message}`);
			process.exit(1);
		}
	};

	const restoreClips = async () => {
		const backupZipPath = await getUserInput(
			"Please enter the path to the backup ZIP file: "
		);

		const absoluteBackupZipPath = path.resolve(backupZipPath);

		const extractPath = path.join(config.backupDir, "temp_restore");
		const absoluteExtractPath = path.resolve(extractPath);

		console.log(chalk.cyan("Starting restore process..."));

		try {
			await extract(absoluteBackupZipPath, { dir: absoluteExtractPath });
			console.log(
				`${chalk.cyan("Extracted backup to")} ${chalk.magenta(
					absoluteExtractPath
				)}`
			);
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
			console.log(
				`${chalk.blue("Restored")} ${chalk.green(
					`clips.json to ${clipsJsonPath}`
				)}`
			);
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
				console.log(
					`${chalk.blue("Restored")} ${chalk.green(`${dir} to ${destDir}`)}`
				);
			} else {
				console.warn(
					`Warning: The directory ${srcDir} does not exist and will be skipped.`
				);
			}
		});

		console.log(chalk.cyan("Restore completed successfully."));
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
