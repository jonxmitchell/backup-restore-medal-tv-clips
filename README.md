# 🗂️ Medal Clips Backup and Restore

This project provides a Node.js script for backing up and restoring Medal.tv clips and associated data. The script supports the inclusion of additional directories specified in a configuration file and ensures that system and protected directories are excluded during the backup and restore processes.

This script is designed to automate the guide provided by Medal.tv on [how to backup clips before formatting your system/OS](https://support.medal.tv/support/solutions/articles/48001227747-how-to-backup-clips-before-formatting-your-system-os).

## Features

- **🔒 Backup Medal.tv clips and data**: Back up specified directories and the `clips.json` file from Medal.tv.
- **♻️ Restore Medal.tv clips and data**: Restore the backed-up directories and `clips.json` file to the original or specified location.
- **🚫 Exclusion of system and protected directories**: Automatically excludes directories like `System Volume Information` and `$RECYCLE.BIN` to avoid permission errors.
- **💬 User prompts for configuration**: Allows the user to input or select paths for backup and restore operations interactively.

## Requirements

- 🛠️ Node.js (version 12.x or higher)

## Installation

1. **📥 Clone the repository**:

   ```bash
   git clone https://github.com/jonxmitchell/medal-clips-backup-restore.git
   cd medal-clips-backup-restore
   ```

2. **📦 Install dependencies**:
   ```bash
   npm install
   ```

## Configuration

1. **📝 Create a `config.json` file** (optional):

   ```json
   {
   	"medalClipsPath": "E:/Medal",
   	"backupDir": "C:/Users/jonxm/OneDrive/Desktop/test",
   	"directoriesToBackup": ["System Volume Information", "Temp"]
   }
   ```

   - `medalClipsPath`: Path to the Medal clips directory.
   - `backupDir`: Path where the backup zip file will be saved.
   - `directoriesToBackup`: Additional directories to back up (optional).

   **Note**: If the `config.json` paths are not specified, the script will prompt the user to enter the paths manually or use the default option.

## Usage

1. **▶️ Run the script**:

   ```bash
   node backup_restore_medal_clips.js
   ```

2. **Choose an option**:

   - **1️⃣ Backup**: Enter `1` to initiate the backup process.
   - **2️⃣ Restore**: Enter `2` to initiate the restore process.

3. **📋 Follow the prompts**:
   - If paths are not specified in the `config.json` file, you will be prompted to enter or select the paths manually or use the default option.
   - When entering paths in the console, ensure to use forward slashes. For example:
     - `"E:/Medal"`
     - `"C:/Users/user/Desktop/test/Medal_Backup_2024_06_19T01_38_47_495Z.zip"`

## Default Backup Location

If the backup directory is not specified in the `config.json` file, the default backup location will be a directory named `Backups` in the root of the script's directory.

## medaldir.json

During the backup process, a file named `medaldir.json` is created and included in the zip archive. This file contains the path to the original Medal clips directory. It is used during the restore process to ensure that the clips and data are restored to their correct locations.

**Example content of `medaldir.json`:**

```json
{
	"medalDir": "E:\\Medal"
}
```

The script reads this file during the restore process to determine the original location of the Medal clips directory, allowing the data to be accurately restored.

## Packages Used

- 📦 [archiver](https://www.npmjs.com/package/archiver): For creating zip archives.
- 📦 [extract-zip](https://www.npmjs.com/package/extract-zip): For extracting zip files.
- 📦 [pretty-bytes](https://www.npmjs.com/package/pretty-bytes): For formatting bytes as human-readable strings.
- 📦 [chalk](https://www.npmjs.com/package/chalk): For adding color to console logs.

## Notes

- 🔐 Ensure you have the necessary permissions to read from and write to the specified directories.
- 📝 The script will log skipped files and directories during the backup and restore processes to avoid permission errors.
- 📂 Default directories (`.Thumbnails`, `Clips`, `editor`, `Edits`, `Screenshots`) are always included in the backup process unless explicitly excluded.

## Contributing

1. 🍴 Fork the repository.
2. 🌿 Create a new branch (`git checkout -b feature-branch`).
3. ✏️ Make your changes.
4. 💾 Commit your changes (`git commit -m 'Add new feature'`).
5. 📤 Push to the branch (`git push origin feature-branch`).
6. 📨 Open a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
