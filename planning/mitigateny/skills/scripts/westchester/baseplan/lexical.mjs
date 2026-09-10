// Build lexical text.root.children from block descriptors.
// blocks: [{h:2, t:"HEADING"} | {p:"paragraph text"} | {p:"", }]  (h=heading tag level, p=paragraph)
function textNode(t){return {detail:0,format:0,mode:"normal",style:"",text:t,type:"text",version:1};}
export function paragraph(t){
  return {children:t?[textNode(t)]:[],direction:t?"ltr":null,format:"",indent:0,type:"paragraph",version:1,textFormat:0,textStyle:""};
}
export function heading(t,tag="h3"){
  return {children:[textNode(t)],direction:"ltr",format:"",indent:0,type:"heading",version:1,tag};
}
// paras: array of strings -> paragraph nodes (verbatim). Optional leading heading.
export function buildRoot(paras, headingText, headingTag){
  const children=[];
  if(headingText) children.push(heading(headingText, headingTag||"h3"));
  for(const p of paras) children.push(paragraph(p));
  return {children, direction:"ltr", format:"", indent:0, type:"root", version:1};
}

// blocks: [{t:"h"|"p", text, tag?}] -> root children (mixed headings/paragraphs)
export function buildRootBlocks(blocks){
  const children=blocks.map(b=> b.t==="h" ? heading(b.text, b.tag||"h3") : paragraph(b.text));
  return {children, direction:"ltr", format:"", indent:0, type:"root", version:1};
}

// list: type ul/ol, items = array of strings
export function buildList(items, ordered){
  return {
    children: items.map((t,i)=>({
      children:[{detail:0,format:0,mode:"normal",style:"",text:t,type:"text",version:1}],
      direction:"ltr",format:"",indent:0,type:"listitem",version:1,value:i+1
    })),
    direction:"ltr",format:"",indent:0,type:"list",version:1,
    listType: ordered?"number":"bullet", start:1, tag: ordered?"ol":"ul"
  };
}
// enhanced block builder: supports {t:"h"|"p"} and {t:"ul"|"ol", items:[...]}
export function buildRootBlocks2(blocks){
  const children=blocks.map(b=>{
    if(b.t==="h") return heading(b.text, b.tag||"h3");
    if(b.t==="ul") return buildList(b.items, false);
    if(b.t==="ol") return buildList(b.items, true);
    return paragraph(b.text);
  });
  return {children, direction:"ltr", format:"", indent:0, type:"root", version:1};
}

// ---------------------------------------------------------------------------
// Convention-compliant builder (loading-a-plan-into-a-2.0-pattern.md,
// "Rich-text formatting for presentation"). Supersedes buildRootBlocks2 for
// page-component fills: that one emits bare paragraphs with none of the
// spacing, indent, bold or link rules.
//
// Blocks in:
//   {t:"p",  runs:[{text,b,i,url}]}
//   {t:"h",  tag:"h3", runs:[...] | text:"..."}
//   {t:"ul"|"ol", items:[ [{text,b,i,url}, ...], ... ]}   // one run-array per item
//
// Rules applied:
//   * leading + trailing empty paragraph
//   * empty paragraph BETWEEN blocks, EXCEPT a heading hugs the block after it
//   * list nodes carry indent:1
//   * bold run -> text node format:1 ; italic -> 2 ; both -> 3
//   * a run with a url -> {type:"link"} wrapping its text node
// ---------------------------------------------------------------------------
const FMT = (b, i) => (b ? 1 : 0) | (i ? 2 : 0);

function txt(t, b, i) {
  return { detail: 0, format: FMT(b, i), mode: "normal", style: "", text: t, type: "text", version: 1 };
}
function linkNode(url, children) {
  return {
    children, direction: "ltr", format: "", indent: 0, type: "link", version: 1,
    rel: "noopener", target: "_blank", title: null, url,
  };
}
// run descriptors -> inline children (text nodes, link nodes)
export function inlineChildren(runs) {
  const out = [];
  for (const r of runs || []) {
    if (!r || !r.text) continue;
    const node = txt(r.text, r.b, r.i);
    out.push(r.url ? linkNode(r.url, [node]) : node);
  }
  return out;
}
export function emptyPara() {
  return { children: [], direction: null, format: "", indent: 0, type: "paragraph", version: 1, textFormat: 0, textStyle: "" };
}
function paraFrom(runs) {
  const children = inlineChildren(runs);
  return { children, direction: children.length ? "ltr" : null, format: "", indent: 0, type: "paragraph", version: 1, textFormat: 0, textStyle: "" };
}
function headingFrom(runs, tag) {
  return { children: inlineChildren(runs), direction: "ltr", format: "", indent: 0, type: "heading", version: 1, tag: tag || "h3" };
}
function listFrom(items, ordered) {
  return {
    children: items.map((runs, idx) => ({
      children: inlineChildren(runs), direction: "ltr", format: "", indent: 0,
      type: "listitem", version: 1, value: idx + 1,
    })),
    direction: "ltr", format: "",
    indent: 1,                     // convention: bullets sit indented from body text
    type: "list", version: 1,
    listType: ordered ? "number" : "bullet", start: 1, tag: ordered ? "ol" : "ul",
  };
}

export function buildFormattedRoot(blocks) {
  const nodes = [];
  for (const b of blocks || []) {
    const runs = b.runs || (b.text != null ? [{ text: b.text, b: false, i: false }] : []);
    if (b.t === "h") nodes.push(headingFrom(runs, b.tag));
    else if (b.t === "ul") nodes.push(listFrom(b.items, false));
    else if (b.t === "ol") nodes.push(listFrom(b.items, true));
    else nodes.push(paraFrom(runs));
  }
  // spacing pass: leading blank, blank after each block, heading hugs next
  const children = [emptyPara()];
  nodes.forEach((n, i) => {
    children.push(n);
    const isLast = i === nodes.length - 1;
    if (n.type === "heading" && !isLast) return;
    children.push(emptyPara());
  });
  return { children, direction: "ltr", format: "", indent: 0, type: "root", version: 1 };
}
