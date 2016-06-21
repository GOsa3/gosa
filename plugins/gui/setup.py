#!/usr/bin/env python
# This file is part of the GOsa project.
#
#  http://gosa-project.org
#
# Copyright:
#  (C) 2016 GONICUS GmbH, Germany, http://www.gonicus.de
#
# See the LICENSE file in the project's top-level directory for details.

from setuptools import setup, find_packages
import os
import platform

try:
    from babel.messages import frontend as babel
except:
    pass

here = os.path.abspath(os.path.dirname(__file__))
README = open(os.path.join(here, 'README.md')).read()
CHANGES = open(os.path.join(here, 'CHANGES')).read()

data_files = []
for path, dirs, files in os.walk("frontend/gosa/build"):
    for f in files:
        data_files.append(os.path.join(path[17:], f))

setup(
    name = "gosa-plugin-gui",
    version = "3.0",
    author = "GONICUS GmbH",
    author_email = "info@gonicus.de",
    description = "GUI for GOsa",
    long_description = README + "\n\n" + CHANGES,
    keywords = "system config management ldap groupware",
    license = "GPL",
    url = "http://gosa-project.org",
    classifiers = [
        'Development Status :: 4 - Beta',
        'Environment :: Console',
        'Intended Audience :: System Administrators',
        'License :: OSI Approved :: GNU General Public License (GPL)',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Topic :: System :: Systems Administration',
        'Topic :: System :: Systems Administration :: Authentication/Directory',
        'Topic :: System :: Software Distribution',
        'Topic :: System :: Monitoring',
    ],

    packages = find_packages('src', exclude=['examples', 'tests']),
    package_dir={'': 'src'},
    namespace_packages = ['gosa.plugin.gui'],

    include_package_data = True,
    package_data = {
        'gosa.plugin.gui': data_files
    },

    zip_safe = False,

    setup_requires = [
        'pylint',
        ],
    install_requires = [
        'gosa.backend',
        ],

    entry_points = """
        [gosa.route]
        /gui/(.*) = gosa.plugin.gui.main:GuiPlugin
    """,
)
