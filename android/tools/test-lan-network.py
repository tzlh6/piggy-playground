"""Host-side real TCP/UDP tests. org.json is test-only; Android supplies it in the APK."""
from pathlib import Path
import argparse, subprocess, os
p=argparse.ArgumentParser()
p.add_argument('--jdk',required=True,type=Path)
p.add_argument('--json-jar',required=True,type=Path)
p.add_argument('--work',required=True,type=Path)
a=p.parse_args()
root=Path(__file__).resolve().parents[1]
suffix='.exe' if (a.jdk/'bin/javac.exe').exists() else ''
a.work.mkdir(parents=True,exist_ok=True)
subprocess.run([str(a.jdk/('bin/javac'+suffix)),'-encoding','UTF-8','--release','8','-cp',str(a.json_jar),'-d',str(a.work),
    str(root/'src/local/piggy/playground/LanNetwork.java'),str(root/'tests/unit/LanNetworkTests.java')],check=True)
subprocess.run([str(a.jdk/('bin/java'+suffix)),'-Dfile.encoding=UTF-8','-cp',str(a.work)+os.pathsep+str(a.json_jar),
    'local.piggy.playground.LanNetworkTests'],check=True)
