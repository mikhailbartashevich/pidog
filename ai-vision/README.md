# Separate PiDog AI Vision server

AI Vision runs on a **separate** Raspberry Pi 5 with an AI HAT+ 2 (Hailo-10H).
The primary PiDog remains the owner of the camera and motors: it sends a JPEG
frame over the trusted local network and receives object and face detections.
The service listens on port `8790` and uses its own `PIDOG_VISION_TOKEN`; never
reuse the PiDog API token.

Board, cooling, and power requirements are in
[../docs/hardware/README.md](../docs/hardware/README.md).

## 1. Prepare the AI Raspberry Pi

1. Install 64-bit Raspberry Pi OS on a Raspberry Pi 5 with 8 GB RAM; connect
   the AI HAT+ 2 and active cooling.
2. Update the OS and install the official AI HAT+ 2 Hailo stack, including
   **Hailo Apps**. The Hailo Apps installer must provide the Python environment
   at `/home/mikhail/hailo-apps/venv_hailo_apps` and Hailo-10H resources under
   `/usr/local/hailo/resources/`.
3. Confirm that
   `/usr/local/hailo/resources/models/hailo10h/yolov8m.hef` exists and that the
   Hailo device is visible to the normal Hailo diagnostic utility.
4. Put the two OpenCV Zoo ONNX face models into the staging directory:

   ```text
   models/face_detection_yunet_2023mar.onnx
   models/face_recognition_sface_2021dec.onnx
   ```

Without those files the service continues to detect Hailo objects, but face
enrollment and recognition are disabled.

## 2. Copy and install the service

Copy the contents of `ai-vision/`, including its `models/` directory, to the
AI Raspberry Pi—for example, `/home/mikhail/pidog-ai-vision-stage/`. On that
Pi, run:

```bash
cd /home/mikhail/pidog-ai-vision-stage
sudo ./install_on_ai_pi.sh "$(pwd)"
```

The installer places the Python service in `/opt/pidog-ai-vision/`, creates
`/var/lib/pidog-ai-vision/`, generates a distinct token in
`/etc/pidog-ai-vision.env`, enables `pidog-ai-vision.service`, and keeps an
SSH-owner-only token copy at `/home/mikhail/.config/pidog-ai-vision.token`.
It does not print the token in logs.

The service source is split into the `pidog_vision/` package: HTTP API,
database migrations, face memory, object memory, and Hailo detection are kept
in separate modules. The installer copies the complete package.

Verify the service locally:

```bash
sudo systemctl status pidog-ai-vision
TOKEN=$(sudo awk -F= '$1=="PIDOG_VISION_TOKEN" {print $2}' /etc/pidog-ai-vision.env)
curl --fail -H "X-PiDog-Vision-Token: $TOKEN" http://127.0.0.1:8790/health
```

## 3. Connect the primary PiDog

Transfer the token directly to the primary PiDog owner, never through Git or a
web client. Add these values to the active primary-server environment file:

```text
PIDOG_VISION_URL=http://AI_PI_ADDRESS:8790
PIDOG_VISION_TOKEN=separate-random-token
PIDOG_VISION_TIMEOUT=4.0
```

Restart only the primary `pidog-voice` service. The browser calls PiDog, and
PiDog calls AI Vision, so the AI Vision token never reaches the browser.

## Face and object memory

- `POST /faces/<name>` appends one clear face embedding and a small JPEG preview
  in `/var/lib/pidog-ai-vision/faces.sqlite3`. Reusing a name adds another
  reference sample; it never replaces an earlier image.
- `POST /objects/<name>` appends a selected object's visual memory in
  `/var/lib/pidog-ai-vision/objects.sqlite3`; reusing a name adds another
  sample and does not retrain the Hailo model.
- An owner can open `http://AI_PI_ADDRESS:8790/admin` from the trusted network,
  enter the separate token, and rename or delete entries.

For the current AI Pi, open `http://192.168.1.158:8790/admin`. Deleting or
renaming a name applies to every sample currently saved under that name.

The service does not save video and has no motor access. Test
`follow_ai_target` only while PiDog is stationary on a clear floor: it must
move the robot head only.

## Database safety

All values supplied to SQLite use parameterized queries. Schema updates use a
fixed allowlist of SQL statements; table and column identifiers are never built
from a request or another runtime value.

## Updating

Copy the updated `pidog_ai_vision.py`, `pidog_vision/` package, `admin.html`,
service file, and any updated ONNX models to the staging directory and run the
installer again. Then run:

```bash
sudo systemctl restart pidog-ai-vision
sudo journalctl -u pidog-ai-vision -n 50 --no-pager
```
