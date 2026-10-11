"""兼容入口：4.2 起猪猪造型统一由 app/pig-art.js 生成，这里调用 node make-pigs.cjs。"""
import subprocess, sys
from pathlib import Path
sys.exit(subprocess.call(['node', str(Path(__file__).resolve().parent / 'make-pigs.cjs')]))
