"""兼容入口：消消乐六种棋子也由 app/pig-art.js 生成（MATCH 列表），这里调用 node make-pigs.cjs。"""
import subprocess, sys
from pathlib import Path
sys.exit(subprocess.call(['node', str(Path(__file__).resolve().parent / 'make-pigs.cjs')]))
