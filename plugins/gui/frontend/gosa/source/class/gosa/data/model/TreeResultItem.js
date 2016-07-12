/*========================================================================

   This file is part of the GOsa project -  http://gosa-project.org
  
   Copyright:
      (C) 2010-2012 GONICUS GmbH, Germany, http://www.gonicus.de
  
   License:
      LGPL-2.1: http://www.gnu.org/licenses/lgpl-2.1.html
  
   See the LICENSE file in the project's top-level directory for details.

======================================================================== */

qx.Class.define("gosa.data.model.TreeResultItem",
{
  extend : qx.core.Object,

  include: [qx.data.marshal.MEventBubbling],

  construct: function(title, prnt){
    this.base(arguments);

    if(prnt){
      this.setParent(prnt);
    }

    if(title){
      this.setTitle(title);
    }

    this.setChildren(new qx.data.Array());
    this.setLeafs(new qx.data.Array());
  },

  members: {

    _onOpen : function(value){
    
      if(!this.isLoaded() && value){
        this.getChildren().removeAll();
        this.load();
      }
    },

    load: function(func, ctx){

      var that = this;

      // If not done yet, resolve the child elements of this container
      if(that.isLoaded()){
        if(func){
          func.apply(ctx);
        }
      }else{

        that.setLoaded(true);
        that.setLoading(true);

        // TODO: check for getHasChildren, once its implemented in the backend

        setTimeout(function(){
          var rpc = gosa.io.Rpc.getInstance();
          if (that.getParent()) {

            // We're looking for entries on the current base
            rpc.cA(function(data, error){
                var newc = new qx.data.Array();
                for(var id in data){
                  var item  = that.parseItemForResult(data[id]);
                  if(item.isContainer()){
                    newc.push(item);
                  }else{
                    that.getLeafs().push(item);
                  }
                }
                that.setChildren(newc);
                that.sortElements();
                if(func){
                  func.apply(ctx);
                }
                that.setLoading(false);
                
              }, that, "search", that.getDn(), "children", null, {secondary: false, 'adjusted-dn': true});

          } else {
            // We're added uppon the root
            // Fetch all available domains
            rpc.cA(function(data, error){

                var queue = 0;

                // Starts a new domain resolve (e.g. "dc=example,dc=net" into a TreeResultItem)
                var resolve = function(name){

                  // Count startet job and once the last has finished sort the elements
                  queue ++;
                  rpc.cA(function(result, error){
                    queue --;

                    // Add the resolved element to the cild list
                    if(result.length == 1){
                      var item = that.parseItemForResult(result[0]);
                      that.getChildren().push(item);

                      // Sort on last resolved domain element
                      if(queue==0){
                        that.sortElements();

                        // Stop loading throbber
                        that.setLoading(false);
                
                        if(func){
                          func.apply(ctx);
                        }
                      }
                    }else{
                      that.error("could not resolve tree element '" + name + "'!");
                    }
                  }, that, "search", name, "base", null, {secondary: false, 'adjusted-dn': true});
                }

                // Start resolve process for each catched domain
                for (var i=0; i<data.length; i++) {
                  resolve(data[i]);
                }

              }, that, "getEntryPoints");
          }
        }, 10);
      }
    },

    /* Sort child and leaf elements
     * */
    sortElements : function(){
      var sortF= function(a,b){
          if(a.getTitle() == b.getTitle()){
            return 0;
          }
          return (a.getTitle() < b.getTitle()) ? -1 : 1;
        }
      this.getChildren().sort(sortF);
      this.getLeafs().sort(sortF);
    },

    /* Parses a result item into a TreeResultItem
     * */
    parseItemForResult: function(result){
      var container = false;
      if(result['container']){
        container = result['container']; 
      }

      var item = new gosa.data.model.TreeResultItem(result['title'], this).set({
          container: container,
          dn: result['dn'],
          description: result['description'],
          title: result['title'],
          type: result['tag'],
          uuid: result['uuid']
        });

      // Add a dummy object if we know that this container has children.
      if(result['hasChildren']){
        item.setHasChildren(true);
        item.getChildren().push(new gosa.data.model.TreeResultItem("Dummy")); 
      }

      return(item);
    },

    /* Returns a table row
     * */
    getTableRow: function(){
      return([this.getType(), 
          this.getTitle(), 
          this.getDescription(),
          this.getDn()]);
    }
  },

  properties : {

    container : {
      check : "Boolean",
      event : "changeContainer",
      init : false
    },

    open : {
      check : "Boolean",
      event : "changeOpen",
      apply : "_onOpen",
      init : false
    },

    loaded : {
      check : "Boolean",
      event : "changeLoaded",
      init : false
    },

    loading : {
      check : "Boolean",
      event : "changeLoading",
      init : false
    },

    hasChildren : {
      check : "Boolean",
      event : "changeHasChildren",
      init : false
    },

    parent : {
      event : "changeParent",
      init : null
    },

    children : {
      check : "Array",
      event : "changeChildren",
      apply: "_applyEventPropagation",
      init : null
    },

    leafs : {
      check : "Array",
      event : "changeLeafs",
      init : null
    },

    title : {
      check : "String",
      event : "changeTitle",
      init : ""
    },

    dn : {
      check : "String",
      event : "changeDn",
      init : ""
    },

    uuid : {
      check : "String",
      event : "changeUuid"
    },

    type : {
      check : "String",
      event : "changeType",
      init : null
    },

    description : {
      check : "String",
      event : "changeDescription",
      init : ""
    }
  }
});