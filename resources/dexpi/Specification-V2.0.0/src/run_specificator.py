
import pathlib
import sys
from dexpi.specificator.command_line import command_line

THIS_DIR = pathlib.Path(__file__).parent

import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s',
    stream=sys.stdout)

def run():
    command_line(
        model_src=THIS_DIR / 'model',
        documentation_src=THIS_DIR / 'documentation',
        cache_dir=THIS_DIR / '.cache',
        args=['make',
              'xml',
              'xmi',
              'html',
              'pdf'
              ])

run()
