import os
import sys
import logging
from lxml import objectify, etree
from gosa.common.utils import N_
from gosa.backend.objects import ObjectProxy
from gosa.common import Environment
from gosa.common.components import PluginRegistry
from gosa.common.error import GosaErrorHandler as C
from pkg_resources import resource_filename


# Register the errors handled  by us
C.register_codes(dict(
    WORKFLOW_SCRIPT_ERROR=N_("Error executing workflow script '%(topic)s'")
))

#TODO: exceptions
#      attribute handling


class WorkflowException(Exception):
    pass


class Workflow:

    env = None
    dn = None
    uuid = None
    _path = None
    _xml_root = None
    __attribute_map = None
    __attribute = None
    __user = None
    __session_id = None
    __reference_object = None
    __log = None

    def __init__(self, _id, what=None, user=None, session_id=None):
        schema = etree.XMLSchema(file=resource_filename("gosa.backend", "data/workflow.xsd"))
        parser = objectify.makeparser(schema=schema)
        self.env = Environment.getInstance()
        self.uuid = _id
        self.dn = self.env.base
        self.__user = user
        self.__session_id = session_id
        self.__log = logging.getLogger(__name__)

        self._path = self.env.config.get("core.workflow_path", "/var/lib/gosa/workflows")
        self._xml_root = objectify.parse(os.path.join(self._path, _id, "workflow.xml"), parser).getroot()

        self.__attribute = {key: None for key in self.get_attributes()}

        if what is not None:
            # load object and copy attribute values to workflow
            try:
                self.__reference_object = ObjectProxy(what)
                for key in self.__attribute:
                    if hasattr(self.__reference_object, key) and getattr(self.__reference_object, key) is not None:
                        setattr(self, key, getattr(self.__reference_object, key))
            except Exception as e:
                # could not open the reference object
                self.__log.error(e)

    def get_methods(self):
        return self.get_all_method_names()

    def get_all_method_names(self):
        return ["commit", "get_templates", "get_translations"]

    def get_attributes(self, detail=False):
        res = self._get_attributes()

        if detail:
            return res

        return list(res.keys())

    def commit(self):
        self.check()
        with open(os.path.join(self._path, self.uuid, "workflow.py"), "r") as fscr:
            return self._execute_embedded_script(fscr.read())

    def get_id(self):
        find = objectify.ObjectPath("Workflow.Id")
        return find(self._xml_root[0]).text

    def get_templates(self):
        templates = {}

        find = objectify.ObjectPath("Workflow.Templates")
        for idx, template in enumerate(find(self._xml_root[0]).getchildren()):
            with open(os.path.join(self._path, self.uuid, "templates", template.text), "r") as ftpl:
                templates[template.text] = {
                    "index": idx,
                    "content": ftpl.read()
                }

        return templates

    def get_translations(self, locale):
        translations = {}

        find = objectify.ObjectPath("Workflow.Templates")
        for template in find(self._xml_root[0]).getchildren():
            translation = template.text[:-5]
            translation_path = os.path.join(self._path, self.uuid, "i18n", translation, "%s.json" % locale)
            if os.path.isfile(translation_path):
                with open(translation_path, "r") as ftpl:
                    translations[template.text] = ftpl.read()
            else:
                translations[template.text] = None

        return translations

    def _load(self, attr, element, default=None):
        """
        Helper function for loading XML attributes with defaults.
        """
        if element not in attr.__dict__:
            return default

        return attr[element]

    def _get_attributes(self):
        if not self.__attribute_map:
            res = {}
            for element in self._xml_root:
                find = objectify.ObjectPath("Workflow.Attributes")
                if find.hasattr(element):
                    for attr in find(element).iterchildren():
                        if attr.tag == "{http://www.gonicus.de/Workflows}Attribute":
                            if attr.Name.text not in res:
                                res[attr.Name.text] = {}

                            values_populate = None
                            value_inherited_from = None
                            if 'Values' in attr.__dict__:
                                if 'populate' in attr.__dict__['Values'].attrib:
                                    values_populate = attr.__dict__['Values'].attrib['populate']

                            if 'InheritFrom' in attr.__dict__:
                                value_inherited_from = {
                                    "rpc": str(self._load(attr, "InheritFrom", "")),
                                    "reference_attribute": attr.__dict__['InheritFrom'].attrib['relation']
                                }

                            res[attr.Name.text] = {
                                'description': str(self._load(attr, "Description", "")),
                                'type': attr.Type.text,
                                'default': str(self._load(attr, "Default", "")),
                                'multivalue': bool(self._load(attr, "MultiValue", False)),
                                'mandatory': bool(self._load(attr, "Mandatory", False)),
                                'readonly': bool(self._load(attr, "ReadOnly", False)),
                                'case_sensitive': bool(self._load(attr, "CaseSensitive", False)),
                                'unique': bool(self._load(attr, "Unique", False)),
                                'values_populate': values_populate,
                                'value_inherited_from': value_inherited_from
                            }

            self.__attribute_map = res

        return self.__attribute_map

    def _execute_embedded_script(self, script):
        try:
            env = dict(data=self._get_data())
            dispatcher = PluginRegistry.getInstance('CommandRegistry')

            def make_dispatch(method):
                def call(*args, **kwargs):
                    return dispatcher.dispatch(self.__user, self.__session_id, method, *args, **kwargs)
                return call

            # Add public calls
            for method in dispatcher.getMethods():
                env[method] = make_dispatch(method)

            # add reference object
            env['reference_object'] = self.__reference_object

            exec(script, env)

        except Exception as e:
            exc_type, exc_obj, exc_tb = sys.exc_info()
            fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]

            print("Exception while executing the embedded script:")
            print(fname, "line", exc_tb.tb_lineno)
            print(exc_type)
            print(exc_obj)
            raise ScriptError(C.make_error('WORKFLOW_SCRIPT_ERROR', e))

        return True

    def __getattr__(self, name):
        # Valid attribute?
        if not name in self._get_attributes():
            raise AttributeError(C.make_error('ATTRIBUTE_NOT_FOUND', name))

        return self.__attribute[name]

    def __setattr__(self, name, value):
        # Store non property values
        try:
            object.__getattribute__(self, name)
            self.__dict__[name] = value
            return
        except AttributeError:
            pass

        # Valid attribute?
        if not name in self._get_attributes():
            raise AttributeError(C.make_error('ATTRIBUTE_NOT_FOUND', name))

        # Validate value
        attribute = self._get_attributes()[name]
        if attribute['mandatory'] and value is None:
            raise AttributeError(C.make_error('ATTRIBUTE_MANDATORY', name))

        self.__attribute[name] = value

    def _get_data(self):
        """
        Returns a dictionary with key being the attribute ids and the values the data the user entered.
        """
        return self.__attribute

    def check(self):
        """
        Checks whether everything is fine with the workflow and its given values or not.
        """
        props = self._get_attributes()
        data = self._get_data()
        # Collect values by store and process the property filters
        for key, prop in self._get_attributes().items():

            # Check if this attribute is blocked by another attribute and its value.
            is_blocked = False
            # for bb in prop['blocked_by']:
            #     if bb['value'] == data[bb['name']]:
            #         is_blocked = True
            #         break

            # Check if all required attributes are set. (Skip blocked once, they cannot be set!)
            if not is_blocked and prop['mandatory'] and data[key] is None or (isinstance(data[key], str) and data[key].strip() == ""):
                raise AttributeError(C.make_error('ATTRIBUTE_MANDATORY', key))

        return props


class ScriptError(Exception):
    pass
