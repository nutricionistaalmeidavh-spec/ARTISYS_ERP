'use strict';
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');

const root=path.resolve(__dirname,'..','frontend','src');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):(x.isFile()&&/\.tsx$/.test(x.name)?[path.join(dir,x.name)]:[]));}
function attr(opening,name){return opening.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.text===name);}
function stringAttr(opening,name){const a=attr(opening,name);return a&&a.initializer&&ts.isStringLiteral(a.initializer)?a.initializer.text:null;}
function isHtml(node,name){return node&&node.tagName&&ts.isIdentifier(node.tagName)&&node.tagName.text===name;}
function enclosingForm(node){for(let p=node.parent;p;p=p.parent){if(ts.isJsxElement(p)&&isHtml(p.openingElement,'form'))return p.openingElement;if(ts.isJsxSelfClosingElement(p)&&isHtml(p,'form'))return p;}return null;}
const issues=[];
for(const file of files(root)){
 const text=fs.readFileSync(file,'utf8');const src=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(node){
  const opening=ts.isJsxElement(node)?node.openingElement:(ts.isJsxSelfClosingElement(node)?node:null);
  if(opening&&isHtml(opening,'button')){
   const hasOnClick=Boolean(attr(opening,'onClick'));const type=stringAttr(opening,'type');const form=enclosingForm(opening);const submit=Boolean(form&&type!=='button'&&type!=='reset'&&attr(form,'onSubmit'));
   if(!hasOnClick&&!submit){const pos=src.getLineAndCharacterOfPosition(opening.getStart(src));issues.push(`${path.relative(path.resolve(__dirname,'..'),file)}:${pos.line+1}:${pos.character+1} button sem onClick nem form onSubmit`);}
  }
  ts.forEachChild(node,visit);
 }
 visit(src);
}
if(issues.length){console.error('UI control contract: FAIL');for(const x of issues)console.error('- '+x);process.exit(1);}console.log('UI control contract: OK');
