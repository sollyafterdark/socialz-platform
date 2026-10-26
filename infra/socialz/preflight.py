#!/usr/bin/env python3
"""Read-only checks before creating or starting the isolated Socialz stack."""
import json
import os
import pathlib
import subprocess

mount = subprocess.check_output(
    ["findmnt", "-n", "-T", "/mnt/storage", "-o", "TARGET,SOURCE,FSTYPE"], text=True
).split()
if mount != ["/mnt/storage", "storage_pool", "zfs"]:
    raise SystemExit("STOP: expected ZFS storage is not mounted.")
root = pathlib.Path(os.environ["SOCIALZ_MEDIA_ROOT"])
expected = pathlib.Path("/mnt/storage/web-services/socialz-platform/uploads")
if root != expected or root.resolve() != expected:
    raise SystemExit("STOP: media path must be the dedicated, non-symlink Socialz path.")
if not root.is_dir():
    raise SystemExit("STOP: create the new Socialz uploads directory before starting.")
if os.stat(root).st_dev != os.stat("/mnt/storage").st_dev:
    raise SystemExit("STOP: uploads do not reside on the verified storage filesystem.")
if os.statvfs("/").f_bavail * os.statvfs("/").f_frsize < 15 * 1024**3:
    raise SystemExit("STOP: fewer than 15 GiB free on the Docker root filesystem.")
print(json.dumps({"raid": "verified", "media_root": str(root), "status": "pass"}))
