
# This file is part of the GOsa project.
#
#  http://gosa-project.org
#
# Copyright:
#  (C) 2016 GONICUS GmbH, Germany, http://www.gonicus.de
#
# See the LICENSE file in the project's top-level directory for details.

import logging
import requests
from sqlalchemy import and_

from gosa.backend.objects import ObjectProxy
from gosa.backend.objects.index import ObjectInfoIndex, KeyValueIndex
from gosa.common import Environment
from gosa.common.components import Command
from gosa.common.components import Plugin
from gosa.backend.exceptions import ACLException
from gosa.common.handler import IInterfaceHandler
from zope.interface import implementer
from gosa.common.error import GosaErrorHandler as C
from gosa.common.utils import N_
from gosa.common.components import PluginRegistry
from gosa.common.gjson import loads


C.register_codes(dict(
    FOREMAN_UNKNOWN_TYPE=N_("Unknown object type '%(type)s'"),
    NO_MAC=N_("No MAC given to identify host '%(hostname)s'"),
    DEVICE_NOT_FOUND=N_("Cannot find device '%(hostname)s'"),
    MULTIPLE_DEVICES_FOUND=N_("(%devices)s found for hostname '%(hostname)s'")
))


class ForemanClient(object):
    """Client for the Foreman REST-API v2"""
    headers = {'Accept': 'version=2,application/json'}

    def __init__(self):
        self.env = Environment.getInstance()
        self.log = logging.getLogger(__name__)
        self.foreman_host = self.env.config.get("foreman.host", "http://localhost/api")

    def get(self, type, id=None):

        url = "%s/%s" % (self.foreman_host, type)
        if id is not None:
            url += "/%s" % id

        response = requests.get(url, headers=self.headers)
        if response.ok:
            data = response.json()
            return data
        elif response.status_code == 404:
            raise ForemanException(C.make_error('FOREMAN_UNKNOWN_TYPE', type=type))
        else:
            response.raise_for_status()


@implementer(IInterfaceHandler)
class Foreman(Plugin):
    _priority_ = 0
    _target_ = "foreman"
    __session = None
    __acl_resolver = None

    def __init__(self):
        self.env = Environment.getInstance()
        self.log = logging.getLogger(__name__)
        self.log.info("initializing foreman plugin")
        self.client = ForemanClient()

    def serve(self):
        # Load DB session
        self.__session = self.env.getDatabaseSession('backend-database')

    def __get_resolver(self):
        if self.__acl_resolver is None:
            self.__acl_resolver = PluginRegistry.getInstance("ACLResolver")
        return self.__acl_resolver

    @Command(needsUser=True, __help__=N_("Adds a host"))
    def addHost(self, user, hostname, params=None, base=None):

        # create dn
        if base is None:
            base = self.env.base

        if user != self:
            topic = "%s.objects.Device" % self.env.domain
            result = self.__get_resolver().check(user, topic, "c")
            if result is None:
                raise ACLException(C.make_error('PERMISSION_CREATE', target=base))

        if params is None or 'mac' not in params:
            # no MAC to identify the host
            raise ForemanException(C.make_error("NO_MAC", hostname=hostname))
        mac = params['mac']
        obj = ObjectProxy(base, "Device")
        obj.extend("ieee802Device")
        obj.cn = hostname
        obj.macAddress = mac
        self.__update_host(obj, params)
        return obj

    @Command(needsUser=True, __help__=N_("Deletes a host"))
    def removeHost(self, user, hostname, params=None):
        # find the host
        device = self.__get_host_object(hostname)

        if user != self:
            # check ACL
            topic = "%s.objects.Device" % self.env.domain
            result = self.__get_resolver().check(user, topic, "d", base=device.get_parent_dn())
            if result is None:
                raise ACLException(C.make_error('PERMISSION_REMOVE', target=device.get_parent_dn()))

        # remove it
        device.remove()

    def update_host(self, hostname):
        """Requests current values from the Foreman api and updates the device"""
        device = self.__get_host_object(hostname)
        new_data = self.client.get("hosts", id=hostname)
        self.__update_host(device, new_data)

    def __update_host(self, device, data):
        if 'location_id' in data:
            device.l = data['location_id']
        device.commit()

    def __get_host_object(self, hostname):
        query = and_(ObjectInfoIndex.uuid == KeyValueIndex.uuid,
                     KeyValueIndex.key == "cn",
                     KeyValueIndex.value == hostname,
                     ObjectInfoIndex._type == "Device")

        res = self.__session.query(ObjectInfoIndex).filter(query)

        if res.count() == 0:
            raise ForemanException(C.make_error("DEVICE_NOT_FOUND", hostname=hostname))
        elif res.count() > 1:
            raise ForemanException(C.make_error("MULTIPLE_DEVICES_FOUND", hostname=hostname, devices=res.count()))
        else:
            res_device = res.first()
            return ObjectProxy(res_device.uuid)


class ForemanWebhookReceiver(object):
    """ Webhook handler for foreman events (Content-Type: application/vnd.acme.hostevent+json) """

    def handle_request(self, request):
        foreman = PluginRegistry.getInstance("Foreman")
        data = loads(request.body)
        print(data)

        if data['action'] == "create":
            foreman.addHost(foreman, data['hostname'], data['parameters'])
        elif data['action'] == "delete":
            foreman.removeHost(foreman, data['hostname'], data['parameters'])


class ForemanException(Exception):
    pass