# PiDog monorepo

The single repository for the larger PiDog project: mobile and web robot
control, the primary Raspberry Pi server, and an independent computer-vision
server. Each component can be developed, tested, and deployed independently.

## Repository map

```text
android/                 Android application and Gradle project
web/                     React, TypeScript, and Vite web control panel
raspberry-pi/            Primary PiDog server: motors, audio, camera, and API
ai-vision/               Separate AI Vision server for a second Raspberry Pi
docs/hardware/           Hardware requirements and configuration options
```

`raspberry-pi/` and `ai-vision/` are distinct services and should not normally
be installed on the same board. The primary PiDog server controls the robot and
owns the camera. AI Vision receives only JPEG frames from it over the local
network, performs detection, and returns results. The services use different
API secrets.

## Getting started

1. Check the [hardware requirements](docs/hardware/README.md).
2. Install the primary server with [raspberry-pi/README.md](raspberry-pi/README.md).
3. If required, set up the independent AI Vision service with
   [ai-vision/README.md](ai-vision/README.md).
4. Build the Android app or start the web control panel.

## Component development

### Android

Open `android/` in Android Studio. JDK 17+ and Android SDK 36 are required.
Build from the repository root with:

```bash
cd android
./gradlew test lint assembleDebug
```

The debug APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.

### Web

The web panel is intended for a trusted local network with PiDog. Its API uses
plain HTTP by design and must not be exposed to the internet.

```bash
cd web
corepack yarn install
corepack yarn dev
```

Use `corepack yarn check` for every quality check and the production build.

### Primary Raspberry Pi server

The server listens on port `8765` and accepts only allow-listed commands with
the `PIDOG_TOKEN`. It provides servo, audio, sensor, local speech-recognition,
camera, and AI Vision bridge functionality. Installation variants for Raspberry
Pi 4/5 and AI HAT+ 2 are documented in
[raspberry-pi/README.md](raspberry-pi/README.md).

### AI Vision

AI Vision is a separate Raspberry Pi 5 with a Hailo accelerator. It listens on
port `8790`, keeps local face/object memory, and never receives motor control.
The independent setup is in [ai-vision/README.md](ai-vision/README.md).

## Monorepo checks

```bash
npm run check:web
npm run check:android
npm run check:python
```

Run all three sequentially with `npm run prepush`.

## Safety

Place PiDog on a clear floor before its first movement. Use long, distinct
tokens for `PIDOG_TOKEN` and `PIDOG_VISION_TOKEN`; never commit them and never
expose ports `8765` or `8790` to the internet. AI Vision currently aims only
the robot head—movement and gestures are never automatic.
