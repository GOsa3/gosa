# This file is part of the GOsa framework.
#
#  http://gosa-project.org
#
# Copyright:
#  (C) 2016 GONICUS GmbH, Germany, http://www.gonicus.de
#
# See the LICENSE file in the project's top-level directory for details.

import unittest
import pytest
from gosa.backend.command import *
from gosa.common.event import EventMaker
from gosa.common.events import ZopeEventConsumer
from tests.GosaTestCase import slow

@slow
class CommandRegistryTestCase(unittest.TestCase):

    def setUp(self):
        super(CommandRegistryTestCase, self).setUp()
        self.reg = PluginRegistry.getInstance("CommandRegistry")

    def test_getBase(self):
        assert self.reg.getBase() == "dc=example,dc=net"

    def test_getMethods(self):
        res = self.reg.getMethods()
        assert len(res) > 0
        assert 'setUserPassword' in res
        assert res['setUserPassword']['doc'] == 'Sets a new password for a user'

        # another locale
        # res = self.reg.getMethods("de")
        # print(res)
        # assert len(res) > 0
        # assert 'setUserPassword' in res
        # assert res['setUserPassword']['doc'] == 'Setzt ein neues Benutzerpasswort'

    def test_shutdown(self):
        with unittest.mock.patch.object(PluginRegistry.getInstance('HTTPService'),'stop') as m:
            assert self.reg.shutdown() is True
            assert m.called is True


    def test_dispatch(self):

        with pytest.raises(CommandNotAuthorized):
            self.reg.dispatch(None, None)

        with pytest.raises(CommandInvalid):
            self.reg.dispatch(self.reg, 'unknownCommand')

        res = self.reg.dispatch(self.reg, 'getBase')
        assert res == "dc=example,dc=net"


    def test_callNeedsUser(self):
        with pytest.raises(CommandInvalid):
            self.reg.callNeedsUser('unknownCommand')

        assert self.reg.callNeedsUser('getSessionUser') is True

    def test_sendEvent(self):
        e = EventMaker()

        backendChangeData = e.Event(
            e.BackendChange(
                e.ModificationTime("20150101000000Z"),
                e.ChangeType("modify")
            )
        )
        data = e.Event(
            e.ObjectChanged(
                e.ModificationTime("20150101000000Z"),
                e.ChangeType("modify")
            )
        )
        data_str = '<Event xmlns="http://www.gonicus.de/Events"><ObjectChanged><ModificationTime>20150101000000Z</ModificationTime><ChangeType>modify</ChangeType></ObjectChanged></Event>'

        mocked_resolver = unittest.mock.MagicMock()
        mocked_resolver.check.return_value = False
        with unittest.mock.patch.dict("gosa.backend.command.PluginRegistry.modules", {'ACLResolver': mocked_resolver}),\
                unittest.mock.patch("gosa.backend.command.SseHandler.send_message") as mocked_sse:

            with pytest.raises(EventNotAuthorized):
                self.reg.sendEvent('admin', data)

            mocked_resolver.check.return_value = True

            with pytest.raises(etree.XMLSyntaxError):
                # message without content
                self.reg.sendEvent('admin', e.Event(e.ObjectChanged()))


            # add listener
            handle_event = unittest.mock.MagicMock()

            ZopeEventConsumer(type='ObjectChanged', callback=handle_event.process)
            self.reg.sendEvent('admin', backendChangeData)
            assert not handle_event.process.called

            # send data as str
            self.reg.sendEvent('admin', data_str)
            assert handle_event.process.called
            args, kwargs = handle_event.process.call_args
            called_string = etree.tostring(args[0])
            assert called_string.decode() == data_str
            handle_event.reset_mock()

            # send data as bytes
            self.reg.sendEvent('admin', bytes(data_str, 'utf-8'))
            assert handle_event.process.called
            args, kwargs = handle_event.process.call_args
            called_string = etree.tostring(args[0])
            assert called_string.decode() == data_str
            handle_event.reset_mock()

            # send data as xml
            self.reg.sendEvent('admin', data)
            assert handle_event.process.called
            args, kwargs = handle_event.process.call_args
            called_string = etree.tostring(args[0])
            assert called_string.decode() == data_str
            handle_event.reset_mock()
