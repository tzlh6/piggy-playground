"""SDK-free regression test for the private WebView origin and packaged asset allowlist."""
from pathlib import Path
import argparse,subprocess,tempfile
parser=argparse.ArgumentParser()
parser.add_argument('--jdk',required=True,type=Path)
parser.add_argument('--work',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
suffix='.exe' if (args.jdk/'bin/javac.exe').exists() else ''
if args.work:args.work.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='piggy-assets-',dir=args.work) as output:
    subprocess.run([str(args.jdk/('bin/javac'+suffix)),'-encoding','UTF-8','--release','8','-d',output,
                    str(root/'src/local/piggy/playground/OfflineAssets.java'),
                    str(root/'tests/unit/OfflineAssetsTests.java')],check=True)
    subprocess.run([str(args.jdk/('bin/java'+suffix)),'-cp',output,'local.piggy.playground.OfflineAssetsTests'],check=True)
