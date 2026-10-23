"""Run host-side ZIP import tests with a JDK, without an Android device."""
from pathlib import Path
import argparse
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--jdk', required=True, type=Path, help='JDK root containing bin/javac and bin/java')
parser.add_argument('--work', type=Path, help='Optional parent directory for temporary test classes')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
suffix = '.exe' if (args.jdk / 'bin/javac.exe').exists() else ''
if args.work:
    args.work.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='piggy-study-tests-', dir=args.work) as output:
    subprocess.run([str(args.jdk / ('bin/javac' + suffix)), '-encoding', 'UTF-8', '--release', '8', '-d', output,
                    'src/local/piggy/playground/StudyBankImporter.java',
                    'tests/unit/StudyBankImporterTests.java'], cwd=root, check=True)
    subprocess.run([str(args.jdk / ('bin/java' + suffix)), '-cp', output,
                    'local.piggy.playground.StudyBankImporterTests'], check=True)
