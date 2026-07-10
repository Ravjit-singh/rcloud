# R Cloud Engine
R Cloud Engine is a high-performance, self-hosted personal cloud storage platform. Engineered for maximum portability, it can be deployed on traditional Linux servers, macOS environments, or run natively on Android devices via Termux. The platform consists of a robust Node.js backend, a responsive Tailwind CSS frontend implementing Material Design 3 guidelines, and a native Kotlin-based Android application.
## Table of Contents
 1. Architecture Overview
 2. Core Features
 3. Prerequisites
 4. Deployment & Installation
 5. System Administration
 6. Android Client Compilation
 7. Security Infrastructure
 8. License
## Architecture Overview
R Cloud follows a monolithic, client-server architecture with hardware-accelerated processing capabilities for media generation.
| Component | Primary Technologies | Functionality & Purpose |
|---|---|---|
| **Backend API** | Node.js, Express.js | Handles RESTful routing, authentication, file I/O operations, and dynamic archive generation. |
| **Database** | SQLite3 (C++ Native) | A zero-configuration, transactional SQL database engine storing user states, file metadata, and folder hierarchies. |
| **Media Engine** | FFmpeg, Sharp | Generates optimized .webp thumbnails for uploaded video and image files on the fly. |
| **Web Interface** | HTML5, Tailwind CSS, JS | A responsive, DOM-manipulated graphical interface utilizing standard Material Design components. |
| **Mobile Client** | Android (Kotlin), WebView | A dedicated application wrapper featuring native storage interception and system-level download management. |
## Core Features
### File & Storage Management
 * **Hierarchical Storage:** Create nested folder structures with seamless navigation.
 * **File Operations:** Move, copy, rename, and securely delete files or entire folder trees.
 * **Batch Archiving:** Select multiple files or folders and download them dynamically as a compiled .zip archive.
 * **Recycle Bin:** Deleted items are moved to a trash state and can be restored or permanently destroyed.
### Sharing & Access Control
 * **Public Links:** Generate shareable links for individual files or entire directories.
 * **Time-to-Live (TTL):** Set specific expiration dates (in days) for shared links.
 * **Cryptographic PIN Protection:** Restrict public link access using 4-digit numeric PINs authenticated via server-side cookies.
### Media Processing
 * **Video Parsing:** Automatically extracts frames at the 10% timestamp of uploaded videos to serve as preview thumbnails.
 * **Image Optimization:** Converts high-resolution image uploads into lightweight thumbnails to minimize bandwidth consumption during gallery navigation.
## Prerequisites
The automated installation script is designed to handle dependency resolution. However, the host environment must support basic package management.
Supported environments include:
 * **Linux:** Debian/Ubuntu-based distributions (apt)
 * **macOS:** Darwin environments (brew)
 * **Android:** Termux Terminal Emulator (pkg)
Required base packages (handled by the installer): git, nodejs, npm, ffmpeg, python3, make, clang, binutils.
## Deployment & Installation
R Cloud features a universal Text User Interface (TUI) installer. The bash script dynamically identifies the host operating system, resolves system-level dependencies, configures native C++ compilation environments (including NDK overrides for Termux), and builds the Node.js architecture.
### Automated Installation
Execute the following command in your target directory to begin the automated setup:
```bash
curl -O https://raw.githubusercontent.com/Ravjit-singh/rcloud/main/install.sh && chmod +x install.sh && ./install.sh

```
### Installation Sequence Details
 1. **Environment Mapping:** Detects OS and assigns the appropriate package manager.
 2. **Dependency Resolution:** Installs compilers, Python runtimes, and media processing binaries.
 3. **Repository Synchronization:** Clones the main branch or updates an existing local repository.
 4. **Backend Compilation:** Executes npm install. Note: During this phase, SQLite3 will be compiled natively from C++ source code. This may take several minutes depending on the host CPU.
### Starting the Server
Upon successful installation, navigate to the server directory and initialize the runtime:
```bash
cd rcloud/server
npm start

```
The terminal will output the local network IP address (e.g., http://192.168.x.x:3000). Use this address to access the platform via a web browser or the native Android client.
## System Administration
R Cloud is built with a strict, approval-based user lifecycle. By default, newly registered accounts cannot log in until explicitly approved by a system administrator.
### Administrator Credentials
 * **Admin Route:** /admin
 * **Default Password:** admin *(It is highly recommended to modify this in the source code prior to production deployment).*
 * **Master Freeze Password:** master
### Admin Capabilities
 * **Account Approval:** Review and authorize pending user registrations.
 * **Storage Auditing:** Monitor global and per-user storage consumption limits.
 * **Account Freezing:** Temporarily revoke a user's write/delete permissions while preserving their read access.
 * **Data Purging:** Permanently destroy user accounts and recursively delete all associated files from the physical disk.
## Android Client Compilation
The repository includes the architecture for a native Android application. This is not a standard web browser shortcut; it utilizes a custom Kotlin bridge to interact with native Android APIs.
### Key Native Integrations
 * **File Chooser Interception:** Overrides the WebView onShowFileChooser method to launch the Android OS native file picker for seamless uploads.
 * **Download Manager Handoff:** Intercepts download requests, retrieves the secure JWT session cookies, and hands the payload to the android.app.DownloadManager for background downloading and system tray notifications.
 * **Cleartext Traffic Bypass:** Specifically engineered to allow local HTTP connections (bypassing Android's default HTTPS-only restriction) for local network server hosting.
### Compilation Steps
 1. Import the project into Android Studio.
 2. Ensure the AndroidManifest.xml includes READ_EXTERNAL_STORAGE and WRITE_EXTERNAL_STORAGE permissions.
 3. Ensure usesCleartextTraffic="true" is declared in the application manifest.
 4. Build the APK using Build > Build Bundle(s) / APK(s) > Build APK(s).
## Security Infrastructure
 * **Authentication:** Stateless authentication utilizing JSON Web Tokens (JWT) signed with a secure cryptographic secret. Tokens are stored in HttpOnly cookies to prevent Cross-Site Scripting (XSS) extraction.
 * **Password Cryptography:** All user passwords are salted and hashed utilizing the bcryptjs algorithm prior to database insertion.
 * **Rate Limiting:** IP-based request throttling is implemented on all authentication endpoints to mitigate brute-force dictionary attacks.
 * **Path Traversal Protection:** File routing and archival processes are strictly sanitized to prevent directory traversal vulnerabilities.
## License
This software is released under the MIT License.
Copyright (c) 2026 Ravjit Singh
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
