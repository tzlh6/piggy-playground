"""Validate the actual packaged document and its size guard with only 64 MiB Java heap."""
from pathlib import Path
import argparse, hashlib, subprocess, tempfile
parser = argparse.ArgumentParser()
parser.add_argument('--jdk', required=True, type=Path)
parser.add_argument('--work', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
suffix = '.exe' if (args.jdk / 'bin/javac.exe').exists() else ''
if args.work: args.work.mkdir(parents=True, exist_ok=True)
page = root / 'assets/game.html'
with tempfile.TemporaryDirectory(prefix='piggy-startup-', dir=args.work) as work:
    subprocess.run([str(args.jdk / ('bin/javac' + suffix)), '-encoding', 'UTF-8', '--release', '8', '-d', work,
        str(root / 'src/local/piggy/playground/StartupPage.java'), str(root / 'tests/unit/StartupPageTests.java')], check=True)
    subprocess.run([str(args.jdk / ('bin/java' + suffix)), '-Xmx64m', '-cp', work,
        'local.piggy.playground.StartupPageTests', str(page), hashlib.sha256(page.read_bytes()).hexdigest()], check=True)
