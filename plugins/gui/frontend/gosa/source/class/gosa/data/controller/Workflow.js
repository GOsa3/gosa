/*
 * This file is part of the GOsa project -  http://gosa-project.org
 *
 * Copyright:
 *    (C) 2010-2017 GONICUS GmbH, Germany, http://www.gonicus.de
 *
 * License:
 *    LGPL-2.1: http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * See the LICENSE file in the project's top-level directory for details.
 */

/**
 * Controller for the {@link gosa.ui.widget.WorkflowWizard} widget; connects it to the model.
 */
qx.Class.define("gosa.data.controller.Workflow", {

  extend : qx.core.Object,

  /**
   * @param workflowObject {gosa.proxy.Object}
   */
  construct : function(workflowObject) {
    this.base(arguments);
    qx.core.Assert.assertInstance(workflowObject, gosa.proxy.Object);
    this.__workflowObject = workflowObject;
  },

  members : {
    /**
     * @type {gosa.proxy.Object}
     */
    __workflowObject : null,

    /**
     * @type {gosa.ui.widgets.WorkflowWizard}
     */
    __widget : null,

    /**
     * @return {gosa.proxy.Object}
     */
    getObject : function() {
      return this.__workflowObject;
    },

    /**
      * @param widget {gosa.ui.widgets.WorkflowWizard}
      */
    setWidget : function(widget) {
      qx.core.Assert.assertInstance(widget, gosa.ui.widgets.WorkflowWizard);
      this.__widget = widget;
    },

    /**
      * @return {Array | null} List of all attributes of the object
    */
    getAttributes : function() {
      return qx.lang.Type.isArray(this.__workflowObject.attributes) ? this.__workflowObject.attributes : null;
    },

    saveAndClose : function() {
      this.__workflowObject.commit().catch(gosa.ui.dialogs.Error.show, this).then(this.close, this);
    },

    close : function() {
      this.__workflowObject.close();
      this.__widget.fireEvent("close");
      this.__widget.destroy();
      this.dispose();
    }
  },

  destruct : function() {
    this.__workflowObject = null;
    this.__widget = null;
  }
});
