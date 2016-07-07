# This file is part of the GOsa framework.
#
#  http://gosa-project.org
#
# Copyright:
#  (C) 2016 GONICUS GmbH, Germany, http://www.gonicus.de
#
# See the LICENSE file in the project's top-level directory for details.

from unittest import mock, TestCase
from gosa.common.components import PluginRegistry, ObjectRegistry

class GosaTestCase(TestCase):

    def setUp(self):
        self._init()

    def tearDown(self):
        self._deinit();

    def _init(self):
        oreg = ObjectRegistry.getInstance()  # @UnusedVariable
        pr = PluginRegistry()  # @UnusedVariable
        cr = PluginRegistry.getInstance("CommandRegistry") # @UnusedVariable

    def _deinit(self):
        PluginRegistry.getInstance('HTTPService').srv.stop()
        PluginRegistry.shutdown()