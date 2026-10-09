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
  forceLinting: forceLinting
};
