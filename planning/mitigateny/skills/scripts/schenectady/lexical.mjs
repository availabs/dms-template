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
