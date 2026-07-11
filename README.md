![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge) ![Build](https://img.shields.io/badge/Build-Stable-brightgreen?style=for-the-badge) ![Platform](https://img.shields.io/badge/Platform-Android_%7C_Linux-lightgrey?style=for-the-badge)

> [!NOTE]
> **R Cloud Engine**
> R Cloud Engine is a high-performance, self-hosted personal cloud storage platform.[span_0](start_span)[span_0](end_span) Engineered for maximum portability, it can be deployed on traditional Linux servers, macOS environments, or run natively on Android devices via Termux.[span_1](start_span)[span_1](end_span) The platform consists of a robust Node.js backend, a responsive Tailwind CSS frontend implementing Material Design 3 guidelines, and a native Kotlin-based Android application.[span_2](start_span)[span_2](end_span)

> [!TIP]
> **Download the Android Client**
> You do not need to compile the mobile application manually. Download the pre-compiled Android APK wrapper directly from the releases page to connect to your vault:
> **[Download R-Cloud.apk (v1.0.0)](https://github.com/Ravjit-singh/rcloud/releases/latest)**

## Table of Contents
 1. [Architecture Overview](#architecture-overview)[span_3](start_span)[span_3](end_span)
 2. [Core Features](#core-features)[span_4](start_span)[span_4](end_span)
 3. [Prerequisites](#prerequisites)[span_5](start_span)[span_5](end_span)
 4. [Deployment & Installation](#deployment--installation)[span_6](start_span)[span_6](end_span)
 5. [System Administration](#system-administration)[span_7](start_span)[span_7](end_span)
 6. [Android Client Compilation](#android-client-compilation)[span_8](start_span)[span_8](end_span)
 7. [Security Infrastructure](#security-infrastructure)[span_9](start_span)[span_9](end_span)
 8. [License](#license)[span_10](start_span)[span_10](end_span)

## Architecture Overview
R Cloud follows a monolithic, client-server architecture with hardware-accelerated processing capabilities for media generation.[span_11](start_span)[span_11](end_span)

| Component | Primary Technologies | Functionality & Purpose |
|---|---|---|
| **Backend API** | Node.js, Express.js | Handles RESTful routing, authentication, file I/O operations, and dynamic archive generation.[span_12](start_span)[span_12](end_span) |
| **Database** | SQLite3 (C++ Native) | A zero-configuration, transactional SQL database engine storing user states, file metadata, and folder hierarchies.[span_13](start_span)[span_13](end_span) |
| **Media Engine** | FFmpeg, Sharp | Generates optimized .webp thumbnails for uploaded video and image files on the fly.[span_14](start_span)[span_14](end_span) |
| **Web Interface** | HTML5, Tailwind CSS, JS | A responsive, DOM-manipulated graphical interface utilizing standard Material Design components.[span_15](start_span)[span_15](end_span) |
| **Mobile Client** | Android (Kotlin), WebView | A dedicated application wrapper featuring native storage interception and system-level download management.[span_16](start_span)[span_16](end_span) |

## Core Features

### File & Storage Management
 * **Hierarchical Storage:** Create nested folder structures with seamless navigation.[span_17](start_span)[span_17](end_span)
 * **File Operations:** Move, copy, rename, and securely delete files or entire folder trees.[span_18](start_span)[span_18](end_span)
 * **Batch Archiving:** Select multiple files or folders and download them dynamically as a compiled .zip archive.[span_19](start_span)[span_19](end_span)
 * **Recycle Bin:** Deleted items are moved to a trash state and can be restored or permanently destroyed.[span_20](start_span)[span_20](end_span)

### Sharing & Access Control
 * **Public Links:** Generate shareable links for individual files or entire directories.[span_21](start_span)[span_21](end_span)
 * **Time-to-Live (TTL):** Set specific expiration dates (in days) for shared links.[span_22](start_span)[span_22](end_span)
 * **Cryptographic PIN Protection:** Restrict public link access using 4-digit numeric PINs authenticated via server-side cookies.[span_23](start_span)[span_23](end_span)

### Media Processing
 * **Video Parsing:** Automatically extracts frames at the 10% timestamp of uploaded videos to serve as preview thumbnails.[span_24](start_span)[span_24](end_span)
 * **Image Optimization:** Converts high-resolution image uploads into lightweight thumbnails to minimize bandwidth consumption during gallery navigation.[span_25](start_span)[span_25](end_span)

## Prerequisites
The automated installation script is designed to handle dependency resolution.[span_26](start_span)[span_26](end_span) However, the host environment must support basic package management.[span_27](start_span)[span_27](end_span)

Supported environments include:
 * **Linux:** Debian/Ubuntu-based distributions (apt)[span_28](start_span)[span_28](end_span)
 * **macOS:** Darwin environments (brew)[span_29](start_span)[span_29](end_span)
 * **Android:** Termux Terminal Emulator (pkg)[span_30](start_span)[span_30](end_span)

Required base packages (handled by the installer): git, nodejs, npm, ffmpeg, python3, make, clang, binutils.[span_31](start_span)[span_31](end_span)

## Deployment & Installation
R Cloud features a universal Text User Interface (TUI) installer.[span_32](start_span)[span_32](end_span) The bash script dynamically identifies the host operating system, resolves system-level dependencies, configures native C++ compilation environments (including NDK overrides for Termux), and builds the Node.js architecture.[span_33](start_span)[span_33](end_span)

> [!IMPORTANT]
> **Automated Installation**
> Execute the following command in your target directory to begin the automated setup:[span_34](start_span)[span_34](end_span)
> ```bash
> curl -O [https://raw.githubusercontent.com/Ravjit-singh/rcloud/main/install.sh](https://raw.githubusercontent.com/Ravjit-singh/rcloud/main/install.sh) && chmod +x install.sh && ./install.sh
> ```

### Installation Sequence Details
 1. **Environment Mapping:** Detects OS and assigns the appropriate package manager.[span_35](start_span)[span_35](end_span)
 2. **Dependency Resolution:** Installs compilers, Python runtimes, and media processing binaries.[span_36](start_span)[span_36](end_span)
 3. **Repository Synchronization:** Clones the main branch or updates an existing local repository.[span_37](start_span)[span_37](end_span)
 4. **Backend Compilation:** Executes npm install.[span_38](start_span)[span_38](end_span) Note: During this phase, SQLite3 will be compiled natively from C++ source code.[span_39](start_span)[span_39](end_span) This may take several minutes depending on the host CPU.[span_40](start_span)[span_40](end_span)

> [!CAUTION]
> **Starting the Server**
> Upon successful installation, navigate to the server directory and initialize the runtime:[span_41](start_span)[span_41](end_span)
> ```bash
> cd rcloud/server
> npm start
> ```
> The terminal will output the local network IP address (e.g., http://192.168.x.x:3000).[span_42](start_span)[span_42](end_span) Use this address to access the platform via a web browser or the native Android client.[span_43](start_span)[span_43](end_span)

## System Administration
R Cloud is built with a strict, approval-based user lifecycle.[span_44](start_span)[span_44](end_span) By default, newly registered accounts cannot log in until explicitly approved by a system administrator.[span_45](start_span)[span_45](end_span)

### Administrator Credentials
 * **Admin Route:** /admin[span_46](start_span)[span_46](end_span)
 * **Default Password:** admin *(It is highly recommended to modify this in the source code prior to production deployment).*[span_47](start_span)[span_47](end_span)
 * **Master Freeze Password:** master[span_48](start_span)[span_48](end_span)

### Admin Capabilities
 * **Account Approval:** Review and authorize pending user registrations.[span_49](start_span)[span_49](end_span)
 * **Storage Auditing:** Monitor global and per-user storage consumption limits.[span_50](start_span)[span_50](end_span)
 * **Account Freezing:** Temporarily revoke a user's write/delete permissions while preserving their read access.[span_51](start_span)[span_51](end_span)
 * **Data Purging:** Permanently destroy user accounts and recursively delete all associated files from the physical disk.[span_52](start_span)[span_52](end_span)

## Android Client Compilation
The repository includes the architecture for a native Android application.[span_53](start_span)[span_53](end_span) This is not a standard web browser shortcut; it utilizes a custom Kotlin bridge to interact with native Android APIs.[span_54](start_span)[span_54](end_span)

### Key Native Integrations
 * **File Chooser Interception:** Overrides the WebView onShowFileChooser method to launch the Android OS native file picker for seamless uploads.[span_55](start_span)[span_55](end_span)
 * **Download Manager Handoff:** Intercepts download requests, retrieves the secure JWT session cookies, and hands the payload to the android.app.DownloadManager for background downloading and system tray notifications.[span_56](start_span)[span_56](end_span)
 * **Cleartext Traffic Bypass:** Specifically engineered to allow local HTTP connections (bypassing Android's default HTTPS-only restriction) for local network server hosting.[span_57](start_span)[span_57](end_span)

### Compilation Steps
 1. Import the project into Android Studio.[span_58](start_span)[span_58](end_span)
 2. Ensure the AndroidManifest.xml includes READ_EXTERNAL_STORAGE and WRITE_EXTERNAL_STORAGE permissions.[span_59](start_span)[span_59](end_span)
 3. Ensure usesCleartextTraffic="true" is declared in the application manifest.[span_60](start_span)[span_60](end_span)
 4. Build the APK using Build > Build Bundle(s) / APK(s) > Build APK(s).[span_61](start_span)[span_61](end_span)

## Security Infrastructure
 * **Authentication:** Stateless authentication utilizing JSON Web Tokens (JWT) signed with a secure cryptographic secret.[span_62](start_span)[span_62](end_span) Tokens are stored in HttpOnly cookies to prevent Cross-Site Scripting (XSS) extraction.[span_63](start_span)[span_63](end_span)
 * **Password Cryptography:** All user passwords are salted and hashed utilizing the bcryptjs algorithm prior to database insertion.[span_64](start_span)[span_64](end_span)
 * **Rate Limiting:** IP-based request throttling is implemented on all authentication endpoints to mitigate brute-force dictionary attacks.[span_65](start_span)[span_65](end_span)
 * **Path Traversal Protection:** File routing and archival processes are strictly sanitized to prevent directory traversal vulnerabilities.[span_66](start_span)[span_66](end_span)

## License
This software is released under the MIT License.[span_67](start_span)[span_67](end_span)

Copyright (c) 2026 Ravjit Singh[span_68](start_span)[span_68](end_span)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:[span_69](start_span)[span_69](end_span)

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.[span_70](start_span)[span_70](end_span)

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.[span_71](start_span)[span_71](end_span) IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.[span_72](start_span)[span_72](end_span)
