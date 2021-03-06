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
 * Completion provider for Application scripts
 *
 * @ignore(monaco.*)
 */
qx.Class.define("gosa.data.editor.completion.Application", {
  extend: gosa.data.editor.completion.Script,

  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */
  members : {

    // overridden
    getProvider: function(lang) {
      // as monaco is currently not supporting bash those scripts were treated as plaintext
      switch (lang) {
        case "plaintext":
        case "bash":
          return {
            triggerCharacters: ["$", "(", "#"],
            provideCompletionItems: this.provideCompletionItems.bind(this)
          };

        case "python":
          return {
            triggerCharacters: ["'", '"', "#"],
            provideCompletionItems: this.provideCompletionItems.bind(this)
          };
      }
    },

    // overridden
    provideCompletionItems: function(model, position) {
      var res = [];
      var language = model.getModeId();
      var textUntilPosition = model.getValueInRange({
        startLineNumber : position.lineNumber,
        startColumn : 1,
        endLineNumber : position.lineNumber,
        endColumn : position.column
      });
      var lastWord = textUntilPosition.split(" ").pop();

      if (lastWord.startsWith("#") && position.lineNumber === 1) {
        // shebang suggestion
        return this.provideShebang(res);
      }

      this._object.get("gosaApplicationParameter").forEach(function(entry) {
        var parts = entry.split(":");
        var variableName = parts[0];
        switch (language) {
          case "plaintext":
          case "bash":
            if (!lastWord.startsWith("$")) {
              variableName = "$"+variableName;
            }
            if (lastWord.startsWith("$(")) {
              variableName += ")";
            }
            break;

          case "python":
            if (lastWord.indexOf("os.environ") === -1) {
              variableName = "os.environ['" + parts[0] + "']";
            }
            break;
        }

        res.push({
          label : parts[0],
          insertText : variableName,
          kind : monaco.languages.CompletionItemKind.Property,
          detail : parts[1]
        })
      });
      return res;
    }
  },

  /*
  *****************************************************************************
     DESTRUCTOR
  *****************************************************************************
  */
  destruct : function() {
    this._object = null;
  }
});