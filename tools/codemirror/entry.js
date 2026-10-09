/* CodeMirror 6, bundled into docs/javascripts/codemirror-bundle.js.
   The browser loads that file from this site. It does not call a CDN. */
import { EditorState, Compartment, Prec, StateEffect } from "@codemirror/state";
import {
  EditorView,
  keymap,
  placeholder,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  tooltips
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion, closeCompletion, completionKeymap, completionStatus } from "@codemirror/autocomplete";
import { linter, lintGutter, forceLinting } from "@codemirror/lint";
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { groovy as groovyMode } from "@codemirror/legacy-modes/mode/groovy";

/* Groovy's stream mode marks calls as plain variables. A "(" after the
   name is a call, so it can take the function colour. */
function groovyToken(stream, state) {
  var style = groovyMode.token(stream, state);
  if ((style === "variable" || style === "property") && /^\s*\(/.test(stream.string.slice(stream.pos))) {
    return style === "property" ? "propertyName.function" : "variableName.function";
  }
  return style;
}

var groovyHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.atom], class: "tok-key" },
  { tag: [tags.string, tags.special(tags.string)], class: "tok-str" },
  { tag: tags.number, class: "tok-num" },
  { tag: tags.comment, class: "tok-cmt" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], class: "tok-fn" }
]);

function groovy() {
  return [
    StreamLanguage.define(Object.assign({}, groovyMode, { token: groovyToken })),
    syntaxHighlighting(groovyHighlight)
  ];
}

globalThis.EmailCodeMirror = {
  EditorState: EditorState,
  EditorView: EditorView,
  Compartment: Compartment,
  Prec: Prec,
  StateEffect: StateEffect,
  keymap: keymap,
  placeholder: placeholder,
  lineNumbers: lineNumbers,
  highlightActiveLine: highlightActiveLine,
  highlightActiveLineGutter: highlightActiveLineGutter,
  drawSelection: drawSelection,
  tooltips: tooltips,
  defaultKeymap: defaultKeymap,
  history: history,
  historyKeymap: historyKeymap,
  autocompletion: autocompletion,
  closeCompletion: closeCompletion,
  completionKeymap: completionKeymap,
  completionStatus: completionStatus,
  linter: linter,
  lintGutter: lintGutter,
  forceLinting: forceLinting,
  groovy: groovy
};
