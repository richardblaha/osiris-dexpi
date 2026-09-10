# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information


project = 'DEXPI Specification'
copyright = '2025, DEXPI'
author = 'DEXPI e.V.'
version = '2.0.0'
release = version

extensions = [
    'sphinx.ext.todo',
    'dexpi.specificator.sphinx_ext',
]

# TODO: make specificator option
todo_include_todos = True

templates_path = ['_templates']
exclude_patterns = []

html_theme = 'piccolo_theme'
html_title = f'{project} {version}'
html_static_path = ['_static']
