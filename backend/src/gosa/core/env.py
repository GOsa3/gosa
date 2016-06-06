# This file is part of the GOsa project.
#
#  http://gosa-project.org
#
# Copyright:
#  (C) 2016 GONICUS GmbH, Germany, http://www.gonicus.de
#
# See the LICENSE file in the project's top-level directory for details.

"""
The environment module encapsulates the access of all
central information like logging and configuration management.

You can import it to your own code like this::

   >>> from gosa.core import Environment
   >>> env = Environment.getInstance()

--------
"""
import logging
import platform
from gosa.core.config import Config

class Environment:
    """
    The global information container, used as a singleton.
    """
    config = None
    log = None
    reset_requested = False
    noargs = False
    __instance = None

    def __init__(self):
        # Load configuration
        self.config = Config(config=Environment.config, noargs=Environment.noargs)
        self.log = logging.getLogger(__name__)

        # Dump configuration
        if self.log.getEffectiveLevel() == logging.DEBUG:
            self.log.debug("configuration dump:")

            for section in self.config.getSections():
                self.log.debug("[%s]" % section)
                items = self.config.getOptions(section)

                for item in items:
                    self.log.debug("%s = %s" % (item, items[item]))

            self.log.debug("end of configuration dump")

        # Load base - we need one
        self.base = self.config.get("core.base")

    def requestRestart(self):
        self.log.warning("a component requested an environment reset")
        self.reset_requested = True

    @staticmethod
    def getInstance():
        """
        Act like a singleton and return the
        :class:`clacks.common.env.Environment` instance.

        ``Return``: :class:`clacks.common.env.Environment`
        """
        if not Environment.__instance:
            Environment.__instance = Environment()
        return Environment.__instance

    @staticmethod
    def reset():
        if Environment.__instance:
            Environment.__instance = None