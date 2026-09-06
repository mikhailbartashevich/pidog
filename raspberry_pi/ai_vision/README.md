# Pi 5 AI vision service

This service is for the separate AI Pi at `192.168.1.158`. It receives a JPEG
from PiDog, runs the Hailo Apps `yolov8m.hef` model on Hailo-10H, and returns
normalized COCO object boxes. Every request needs `X-PiDog-Vision-Token`.

## Face names

Face matching is intentionally disabled until two OpenCV Zoo ONNX files are
present on the AI Pi:

```text
/opt/pidog-ai-vision/models/face_detection_yunet_2023mar.onnx
/opt/pidog-ai-vision/models/face_recognition_sface_2021dec.onnx
```

Once installed, teach a name with a clear JPEG containing exactly one face:

```bash
curl --fail -X POST --data-binary @mikhail.jpg \
  -H 'Content-Type: image/jpeg' \
  -H "X-PiDog-Vision-Token: $PIDOG_VISION_TOKEN" \
  'http://127.0.0.1:8790/faces/Mikhail'
```

The database is `/var/lib/pidog-ai-vision/faces.sqlite3`; it stores embeddings,
a compact JPEG preview, and no camera footage. Saving more than one name for
the same clear crop supports aliases and different languages. List or remove
names with authenticated `GET /faces` and `DELETE /faces/<name>` requests.

## User-named objects

`POST /objects/<name>` saves a selected object crop as local visual memory;
`DELETE /objects/<name>` removes it. The service compares later Hailo detection
crops against that compact colour/shape descriptor and adds the saved name when
the match is strong. The same SQLite row includes a compact JPEG preview. This
does not retrain the base Hailo detector.

## Memory administration page

Open `http://192.168.1.158:8790/admin` from the trusted LAN. The page requires
the separate vision token and then shows thumbnails, names, rename controls,
and delete controls for face and object memory. The token is available only to
the Pi 5 owner in `/home/mikhail/.config/pidog-ai-vision.token`.

## PiDog configuration

On PiDog, add these values to the active service environment file, then restart
only `pidog-voice`:

```text
PIDOG_VISION_URL=http://192.168.1.158:8790
PIDOG_VISION_TOKEN=the-same-separate-vision-token
PIDOG_VISION_TIMEOUT=4.0
```

Use the new `follow_ai_target` command to follow a recognized face or the
largest person detection. It only moves the head. `stop_ai_target` stops it.
Do not reuse the PiDog API token for this service.

## Safe deployment order

1. Copy `pidog_ai_vision.py` and the two ONNX files to `/opt/pidog-ai-vision/`.
2. Create `/var/lib/pidog-ai-vision/`, owned by `mikhail`.
3. Create root-readable `/etc/pidog-ai-vision.env` with a new random token.
4. Install and start `pidog-ai-vision.service`.
5. Verify `GET /health` locally using that token.
6. Deploy the updated PiDog package, configure its two environment values, and
   test `follow_ai_target` with PiDog stationary on a clear floor.

`install_on_ai_pi.sh` performs steps 1–5 after source has been staged. It must
be run through a local `sudo` prompt on the AI Pi; it never prints the newly
generated token.
