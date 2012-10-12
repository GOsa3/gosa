/*========================================================================

   This file is part of the GOsa project -  http://gosa-project.org
  
   Copyright:
      (C) 2010-2012 GONICUS GmbH, Germany, http://www.gonicus.de
  
   License:
      LGPL-2.1: http://www.gnu.org/licenses/lgpl-2.1.html
  
   See the LICENSE file in the project's top-level directory for details.

======================================================================== */

qx.Class.define("gosa.ui.widgets.QPlainTextEditWidget", {

  extend: gosa.ui.widgets.MultiEditWidget,

  members: {
 
    _default_value: "",

    /* Creates an input-widget depending on the echo mode (normal/password)
     * and connects the update listeners
     * */
    _createWidget: function(){
      var w = new qx.ui.form.TextArea();
      if(this.getPlaceholder()){
        w.setPlaceholder(this.getPlaceholder());
      }

      if(this.getMaxLength()){
        w.setMaxLength(this.getMaxLength());
      }

      w.setLiveUpdate(true);
      w.addListener("focusout", this._propertyUpdater, this);
      w.addListener("changeValue", this._propertyUpdaterTimed, this);
      w.getContentElement().setAttribute("spellcheck", true);
      this.bind("valid", w, "valid");
      this.bind("invalidMessage", w, "invalidMessage");
      return(w);
    }
  }
});
