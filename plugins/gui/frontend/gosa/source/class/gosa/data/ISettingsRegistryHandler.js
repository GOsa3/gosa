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
* The Interface for setting registry handlers
*/
qx.Interface.define("gosa.data.ISettingsRegistryHandler", {

  /*
  *****************************************************************************
     PROPERTIES
  *****************************************************************************
  */
  properties : {
    namespace: {}
  },

  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */
  members : {

    has: function(key) {},

    set: function(key, value) {},

    get: function(key) {}

  }
});