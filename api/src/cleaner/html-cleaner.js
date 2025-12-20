import { parseFragment, serialize } from "parse5";
import { REMOVABLE_ATTRIBUTES, SAFE_TAGS } from "./defaults";

export class HtmlCleaner {

  clean(html) {
    const fragment = parseFragment(html);
    this.walk(fragment);

    return serialize(fragment);
  }

  walk(node) {
    if (!node) return;

    if (node.attrs) {
      node.attrs = node.attrs.filter(attr => {
        if (!REMOVABLE_ATTRIBUTES.includes(attr.name)) return true;
        return attr.value && attr.value.trim() !== "";
      });
    }

    if (node.childNodes) {
      node.childNodes = node.childNodes
        .map(child => {
          this.walk(child);
          return child;
        })
        .filter(child => !this.isEmptyNode(child));
    }
  }

  isEmptyNode(node) {
    if (node.nodeName === "#text") {
      return node.value.trim() === "";
    }

    if (SAFE_TAGS.includes(node.nodeName)) return false;

    if (!node.childNodes || node.childNodes.length === 0) {
      return true;
    }

    return node.childNodes.every(
      child =>
        child.nodeName === "#text" &&
        child.value.trim() === ""
    );
  }

}
