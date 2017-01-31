/*========================================================================

   This file is part of the GOsa project -  http://gosa-project.org

   Copyright:
      (C) 2010-2017 GONICUS GmbH, Germany, http://www.gonicus.de

   License:
      LGPL-2.1: http://www.gnu.org/licenses/lgpl-2.1.html

   See the LICENSE file in the project's top-level directory for details.

======================================================================== */

/**
 * Controller for the {@link gosa.ui.widget.ObjectEdit} widget; connects it to the model.
 */
qx.Class.define("gosa.data.controller.ObjectEdit", {

  extend : qx.core.Object,

  /**
   * @param obj {gosa.proxy.Object}
   * @param widget {gosa.ui.widgets.ObjectEdit}
   */
  construct : function(obj, widget) {
    this.base(arguments);
    qx.core.Assert.assertInstance(obj, gosa.proxy.Object);
    qx.core.Assert.assertInstance(widget, gosa.ui.widgets.ObjectEdit);

    this.__object = obj;
    this._widget = widget;
    this._changeValueListeners = {};
    this._validatingWidgets = [];
    this._connectedAttributes = [];
    this.__extensionFinder = new gosa.data.util.ExtensionFinder(obj);
    this.__extensionController = new gosa.data.controller.Extensions(obj, this);
    this.__backendChangeController = new gosa.data.controller.BackendChanges(obj, this);

    this._addListenersToAllContexts();
    this._setUpWidgets();

    this._widget.addListener("contextAdded", this._onContextAdded, this);
    obj.addListener(
      "foundDifferencesDuringReload",
      this.__backendChangeController.onFoundDifferenceDuringReload,
      this.__backendChangeController
    );

    this.__object.setUiBound(true);
    this._initialized = true;
    this.fireEvent("initialized");

    this.__extensionController.checkForMissingExtensions();

    obj.addListener("closing", this._onObjectClosing, this);
  },

  events : {
    /**
     * Fired when all setup etc. is done.
     */
    "initialized" : "qx.event.type.Event"
  },

  properties : {
    modified : {
      check : "Boolean",
      init : false,
      event : "changeModified"
    },

    valid : {
      check : "Boolean",
      init : true,
      event : "changeValid"
    }
  },

  members : {
    __object : null,
    _widget : null,
    _changeValueListeners : null,
    _currentWidget : null,
    _currentBuddy : null,
    _initialized : false,
    _validatingWidgets : null,
    _connectedAttributes : null,
    _globalObjectListenersSet : false,
    __extensionController : null,
    __backendChangeController : null,
    __extensionFinder : null,

    closeWidgetAndObject : function() {
      this._widget.close();
      this.closeObject();
    },

    closeObject : function() {
      if (this.__object && !this.__object.isDisposed() && !this.__object.isClosed()) {
        this.__object.setUiBound(false);
        return this.__object.close()
        .catch(function(error) {
          new gosa.ui.dialogs.Error(error).open();
        });
      }
    },

    saveObject : function() {
      if (!this.isModified()) {
        this.__object.setUiBound(false);
        this.closeObject();
        return;
      }

      if (!this.isValid()) {
        console.warn("TODO: Invalid values detected");
        return;
      }

      return this.__object.commit()
      .catch(function(exc) {
        var error = exc.getData();
        var widget = null;
        this.setValid(false);
        if (error.topic) {
          // create all extension tabs until widget has been found
          var widgetBuddyTuple = this._findWidgets(error.topic, true);
          if (widgetBuddyTuple) {
            widget = widgetBuddyTuple.widget;
            // open tab with widget
            this._widget.openTab(widgetBuddyTuple.context);
          }
        }
        if (widget) {
          this.__showWidgetError(widget, error);
          throw exc;
        }
      }, this)
      .then(function() {
        this.__object.setUiBound(false);
        return this.closeObject();
      }, this);
    },

    /**
     * Calls the method on the object.
     *
     * @param methodName {String} The method to call
     * @param args {Array ? null} Arguments to pass to that function
     */
    callObjectMethod : function(methodName, args) {
      qx.core.Assert.assertString(methodName);
      qx.core.Assert.assertFunction(this.__object[methodName]);

      return this.__object[methodName].apply(this.__object, args);
    },

    /**
     * @return {gosa.data.controller.Extensions}
     */
    getExtensionController : function() {
      return this.__extensionController;
    },

    /**
     * @return {gosa.data.util.ExtensionFinder}
     */
    getExtensionFinder : function() {
      return this.__extensionFinder;
    },

    /**
     * @return {gosa.data.controller.Actions}
     */
    getActionController : function() {
      if (!this._actionController) {
        this._actionController =  new gosa.data.controller.Actions(this.__object);
      }
      return this._actionController;
    },

    /**
     * Returns all extensions which are currently active on the object.
     *
     * @return {Array} List of extension names (strings); might be empty
     */
    getActiveExtensions : function() {
      var result = [];
      var allExts = this.__object.extensionTypes;

      for (var ext in allExts) {
        if (allExts.hasOwnProperty(ext) && allExts[ext]) {
          result.push(ext);
        }
      }
      return result;
    },

    /**
     * @param name {String} Extension name
     * @return {gosa.engine.Context | null}
     */
    getContextByExtensionName : function(name) {
      qx.core.Assert.assertString(name);

      return this._widget.getContexts().find(function(context) {
        return context.getExtension() === name;
      });
    },

    /**
     * @return {String | null} The base type of the object; null if unkown
     */
    getBaseType : function() {
      return this.__object.baseType || null;
    },

    /**
     * @return {Array | null} List of all attributes of the object
     */
    getAttributes : function() {
      return qx.lang.Type.isArray(this.__object.attributes) ? this.__object.attributes : null;
    },

    /**
     * @param attributeName {String}
     * @return {qx.ui.core.Widget | null} Existing attribute for the attribute name
     */
    getWidgetByAttributeName : function(attributeName) {
      qx.core.Assert.assertString(attributeName);
      var contexts = this._widget.getContexts();
      var map;

      for (var i=0; i < contexts.length; i++) {
        map = contexts[i].getWidgetRegistry().getMap();
        if (map.hasOwnProperty(attributeName)) {
          return map[attributeName];
        }
      }
      return null;
    },

    /**
     * @param attributeName {String}
     * @return {gosa.ui.widgets.QLabelWidget | null}
     */
    getBuddyByAttributeName : function(attributeName) {
      qx.core.Assert.assertString(attributeName);
      var contexts = this._widget.getContexts();
      var map;

      for (var i=0; i < contexts.length; i++) {
        map = contexts[i].getBuddyRegistry().getMap();
        if (map[attributeName]) {
          return map[attributeName];
        }
      }
      return null;
    },

    /**
     * Called when the event {@link gosa.proxy.Object#closing} is sent.
     */
    _onObjectClosing : function(event) {
      var data = event.getData();

      // TODO: How can this happen?
      if (data.uuid !== this.__object.uuid) {
        return;
      }

      switch (data.state) {
        case "closing":
          this._widget.onClosing(this.__object.dn, parseInt(data.minutes));
          break;
        case "closing_aborted":
          this._widget.closeClosingDialog();
          break;
        case "closed":
          this.__object.setClosed(true);
          this._widget.onClosed();
          break;
      }
    },

    /**
     * Invoke rpc to continue editing while the timeout for automatic closing is running.
     */
    continueEditing : function() {
      gosa.io.Rpc.getInstance().cA("continueObjectEditing", this.__object.instance_uuid);
    },

    /**
     * Removes the tab page (widget only!) for the given extension.
     *
     * @param extension {String} Name of the extension, e.g. SambaUser
     */
    removeExtensionTab : function(extension) {
      qx.core.Assert.assertString(extension);

      // find all matching contexts (could be several for one extension)
      var contexts = this._widget.getContexts().filter(function(context) {
        return context.getExtension() === extension;
      });

      contexts.forEach(function(context) {
        this._widget.removeTab(context.getRootWidget());
      }, this);
    },

    /**
     * Adds tab pages (widget only) for the given extension.
     *
     * @param templateObjects {Array}
     */
    addExtensionTabs : function(templateObjects) {
      qx.core.Assert.assertArray(templateObjects);

      var extensions = templateObjects.map(function(tmpl) {
        return tmpl.extension;
      });

      var contexts = this._widget.getContexts().filter(function(context) {
        return qx.lang.Array.contains(extensions, context.getExtension());
      });

      if (contexts.length) {
        contexts.forEach(function (context) {
          var map = context.getWidgetRegistry().getMap();
          var widget;

          for (var key in map) {
            if (map.hasOwnProperty(key)) {
              widget = map[key];
              if (widget.isEnabled() && !widget.isBlocked()) {
                widget.enforceUpdateOnServer();
              }
            }
          }
        });
      }
      else {
        templateObjects.forEach(function(templateObject) {
          this._widget.addTab(templateObject);
        }, this);
      }
    },

    _addListenersToAllContexts : function() {
      this._widget.getContexts().forEach(this._addListenerToContext, this);
    },

    _addListenerToContext : function(context) {
      if (!context.isAppeared()) {
        context.addListenerOnce("widgetsCreated", this._setUpWidgets, this);
      }
    },

    _setUpWidgets : function() {
      this._connectModelWithWidget();
      this._addModifyListeners();
    },

    _connectModelWithWidget : function() {
      var o = this.__object;
      var widgets, attribute;

      for (var name in o.attribute_data) {
        if (o.attribute_data.hasOwnProperty(name)) {

          if (qx.lang.Array.contains(this._connectedAttributes, name)) {
            continue;
          }

          attribute = o.attribute_data[name];
          widgets = this._findWidgets(name);
          if (widgets === null) {
            continue;
          }

          if (widgets.hasOwnProperty("widget") && widgets.widget instanceof qx.ui.core.Widget) {
            this._currentWidget = widgets.widget;
          }
          else {
            this._currentWidget = null;
          }

          if (widgets.hasOwnProperty("buddy") && widgets.buddy instanceof qx.ui.core.Widget) {
            this._currentBuddy = widgets.buddy;
          }
          else {
            this._currentBuddy = null;
          }

          this._handleProperties(attribute);
          this._currentWidget.setValue(o.get(name));

          // binding from widget to model
          this._currentWidget.bind("value", o, name);
        }
      }

      if (!this._globalObjectListenersSet) {
        o.addListener("propertyUpdateOnServer", this._onPropertyUpdateOnServer, this);
        this._globalObjectListenersSet = true;
      }
    },

    _addModifyListeners : function() {
      this._widget.getContexts().forEach(function(context) {
        var widgets = context.getWidgetRegistry().getMap();
        var widget, listenerId;
        for (var modelPath in widgets) {
          if (widgets.hasOwnProperty(modelPath)) {
            if (qx.lang.Array.contains(this._connectedAttributes, modelPath)) {
              continue;
            }
            widget = widgets[modelPath];
            listenerId = widget.addListener("changeValue", this._onChangeWidgetValue, this);
            widget[listenerId] = this._currentWidget;

            // check validity
            if (widget instanceof gosa.ui.widgets.Widget) {
              this._validatingWidgets.push(widget);
            }

            this._connectedAttributes.push(modelPath);
          }
        }
      }, this);
    },

    /**
     * Finds the widget and its buddy label for the given name (model path).
     *
     * @param name {String} The name/model path of the widgets
     * @param createWidgets {Boolean?} if true widgets for context will be created if necessary
     * @return {Object | null} An object in the shape of {widget: <widget>, buddy: <buddy widget>, context: <context>} or null
     */
    _findWidgets : function(name, createWidgets) {
      qx.core.Assert.assertString(name);

      var context;
      var contexts = this._widget.getContexts();

      for (var i = 0; i < contexts.length; i++) {
        context = contexts[i];
        if (createWidgets === true && !context.isAppeared()) {
          context._createWidgets();
        }
        var widgets = context.getWidgetRegistry().getMap();
        for (var modelPath in widgets) {
          if (widgets.hasOwnProperty(modelPath) && modelPath === name) {
            return {
              widget : widgets[modelPath],
              buddy : context.getBuddyRegistry().getMap()[modelPath],
              context : context
            };
          }
        }
      }
      return null;
    },

    /**
     * @param attribute {Object}
     */
    _handleProperties : function(attribute) {
      var setValue = {};

      if (attribute.hasOwnProperty("mandatory")) {
        setValue.mandatory = !!attribute.mandatory;
      }
      if (attribute.hasOwnProperty("readonly")) {
        setValue.readOnly = !!attribute.readonly;
      }
      if (attribute.hasOwnProperty("multivalue")) {
        setValue.multivalue = !!attribute.multivalue;
      }
      if (attribute.hasOwnProperty("default")) {
        setValue.defaultValue = attribute["default"];
      }
      if (attribute.hasOwnProperty("type")) {
        setValue.type = attribute.type;
      }
      if (attribute.hasOwnProperty("case_sensitive")) {
        setValue.caseSensitive = attribute.case_sensitive;
      }
      if (attribute.hasOwnProperty("unique")) {
        setValue.unique = attribute.unique;
      }
      if (attribute.hasOwnProperty("depends_on")) {
        setValue.dependsOn = attribute.depends_on;
      }
      if (attribute.hasOwnProperty("values")) {
        setValue.values = attribute.values;
      }

      if (this._currentWidget) {
        this._currentWidget.set(setValue);
      }
      if (this._currentBuddy) {
        this._currentBuddy.set(setValue);
      }


      if (attribute.hasOwnProperty("blocked_by")) {
        var cw = this._currentWidget;
        var cd = this._currentBuddy;
        this._handleBlockedBy(attribute.blocked_by, function() {
          this.__initCompleteWidget(cw);
          this.__initCompleteWidget(cd);
        }, this);
      }
      else {
        this.__initCompleteWidget(this._currentWidget);
        this.__initCompleteWidget(this._currentBuddy);
      }
    },

    __initCompleteWidget : function(widget) {
      if (!widget) {
        return;
      }

      qx.core.Assert.assertInstance(widget, gosa.ui.widgets.Widget);
      (new qx.util.DeferredCall(function() {
        if (!widget.isDisposed()) {
          widget.setInitComplete(true);
        }
      })).schedule();
    },

    _handleBlockedBy : function(value, callback, context) {
      if (value.length === 0) {
        if (callback) {
          callback.call(context);
        }
        return;
      }
      var allWidgets = [];
      var currentBuddy = this._currentBuddy;
      var currentWidget = this._currentWidget;

      var listenerCallback = function() {
        var block = allWidgets.some(function(item) {
          var value = item.widget.getValue();
          if (value instanceof qx.data.Array && value.getLength() > 0) {
            value = value.getItem(0);
          }
          return value === item.value;
        });

        if (block) {
          if (currentBuddy) {
            currentBuddy.block();
          }
          if (currentWidget) {
            currentWidget.block();
          }
        }
        else {
          if (currentBuddy) {
            currentBuddy.unblock();
          }
          if (currentWidget) {
            currentWidget.unblock();
          }
        }

        if (callback) {
          callback.call(context);
        }
      };

      value.forEach(function(item) {
        var widgets = this._findWidgets(item.name);
        if (widgets && widgets.widget) {
          allWidgets.push({
            widget : widgets.widget,
            value : item.value
          });
          widgets.widget.addListener("changeValue", listenerCallback);
        }
      }, this);

      if (this._initialized) {
        // deferred to make sure everything is loaded completely
        (new qx.util.DeferredCall(listenerCallback, this)).schedule();
      }
      else {
        this.addListenerOnce("initialized", listenerCallback);
      }
    },

    /**
     * @param event {qx.event.type.Data}
     */
    _onChangeWidgetValue : function(event) {
      if (!this._initialized) {
        return;
      }
      qx.core.Assert.assertInstance(event, qx.event.type.Data);

      if (!event.getData().getUserData("initial")) {
        this.setModified(true);
        var attr = event.getTarget().getAttribute();
        this.__object.setAttribute(attr, event.getData());
      }
    },

    /**
     * Called when the event "propertyUpdateOnServer" is fired on the object.
     *
     * @param event {qx.event.type.Data}
     */
    _onPropertyUpdateOnServer : function(event) {
      var data = event.getData();
      var widget = null;
      if (data.property) {
        widget = this._validatingWidgets.find(function(widget) {
          return widget instanceof gosa.ui.widgets.Widget && widget.getAttribute() === data.property;
        });
      }

      if (data.success) {
        if (widget) {
          widget.resetErrorMessage();
        }
      }
      else if (!data.success && data.error) {
        this.__showWidgetError(widget, data.error.getData());
      }
      this._updateValidity();
    },

    __showWidgetError: function(widget, error) {
      if (error.code === "ATTRIBUTE_CHECK_FAILED" || error.code === "ATTRIBUTE_MANDATORY") {
        if (widget) {
          widget.setError(error);
        }
      }
      else {
        new gosa.ui.dialogs.Error(error).open();
      }
    },

    _cleanupChangeValueListeners : function() {
      for (var id in this._changeValueListeners) {
        if (this._changeValueListeners.hasOwnProperty(id)) {
          if (!this._changeValueListeners[id].isDisposed()) {
            this._changeValueListeners[id].removeListenerById(id);
          }
        }
      }
      this._changeValueListeners = {};
    },

    _updateValidity : function() {
      this.setValid(this._validatingWidgets.every(function(widget) {
        return widget.isValid() || widget.isBlocked();
      }));
    },

    /**
     * Check the widgets validity for the given context
     *
     * @param context {gosa.engine.Context}
     * @return {boolean}
     */
    checkValidity : function(context) {
      var valid = true;
      if (context) {
        var contextWidgets = context.getWidgetRegistry().getMap();
        for (var modelPath in contextWidgets) {
          if (contextWidgets.hasOwnProperty(modelPath)) {
            var widget = contextWidgets[modelPath];
            valid = valid && (this._validatingWidgets.indexOf(widget) === -1 || widget.isValid() || widget.isBlocked());
          }
        }
      }
      return valid;
    },

    /**
     * @param event {qx.event.type.Data}
     */
    _onContextAdded : function(event) {
      this._addListenerToContext(event.getData());
      this._setUpWidgets();
    }
  },

  destruct : function() {
    this.__object.removeListener("closing", this._onObjectClosing, this);
    this.__object.removeListener(
      "foundDifferencesDuringReload",
      this.__backendChangeController.onFoundDifferenceDuringReload,
      this.__backendChangeController
    );
    this._widget.removeListener("contextAdded", this._onContextAdded, this);

    if (this.__object && !this.__object.isDisposed()) {
      this.__object.removeListener("propertyUpdateOnServer", this._onPropertyUpdateOnServer, this);
    }

    this._cleanupChangeValueListeners();
    this.closeObject();

    this._disposeObjects("__extensionFinder", "__backendChangeController", "__extensionController");

    this.__object = null;
    this._widget = null;
    this._changeValueListeners = null;
    this._validatingWidgets = null;
    this._connectedAttributes = null;
  }
});
