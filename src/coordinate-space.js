(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GrabbrCoordinateSpace=api;})(typeof self!=='undefined'?self:this,function(){
'use strict';
const finite=(v,f)=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):f;
function createDocumentSpace(bitmapWidth,bitmapHeight,options={}){
  const bw=finite(bitmapWidth,1),bh=finite(bitmapHeight,1);
  const lw=finite(options.logicalWidth,bw/finite(options.scaleX,1));
  const lh=finite(options.logicalHeight,bh/finite(options.scaleY,1));
  return {version:2,bitmapWidth:bw,bitmapHeight:bh,logicalWidth:lw,logicalHeight:lh,scaleX:bw/lw,scaleY:bh/lh};
}
function logicalToBitmap(point,space){return{x:point.x*space.scaleX,y:point.y*space.scaleY};}
function bitmapToLogical(point,space){return{x:point.x/space.scaleX,y:point.y/space.scaleY};}
function logicalRectToBitmap(rect,space){return{x:rect.x*space.scaleX,y:rect.y*space.scaleY,width:rect.width*space.scaleX,height:rect.height*space.scaleY};}
function clientToLogical(client,rect,space,marginLogical=0){
  const cssX=client.x-rect.left,cssY=client.y-rect.top;
  const totalLogicalWidth=space.logicalWidth+marginLogical*2,totalLogicalHeight=space.logicalHeight+marginLogical*2;
  return{x:cssX*(totalLogicalWidth/rect.width)-marginLogical,y:cssY*(totalLogicalHeight/rect.height)-marginLogical};
}
function displaySize(space,marginLogical=0,zoom=1){return{width:(space.logicalWidth+marginLogical*2)*zoom,height:(space.logicalHeight+marginLogical*2)*zoom};}
function scaleAnnotation(item,factorX,factorY=factorX){
  const out=JSON.parse(JSON.stringify(item));
  if(out.type==='pen')out.points=out.points.map(p=>({x:p.x/factorX,y:p.y/factorY}));
  else if(out.type==='text'||out.type==='step'){out.x/=factorX;out.y/=factorY;if(out.fontSize)out.fontSize/=Math.sqrt(factorX*factorY);if(out.radius)out.radius/=Math.sqrt(factorX*factorY);if(out.width)out.width/=factorX;}
  else{out.x1/=factorX;out.x2/=factorX;out.y1/=factorY;out.y2/=factorY;}
  if(out.width&&out.type!=='text')out.width/=Math.sqrt(factorX*factorY);
  return out;
}
function normalizeLegacyScene(scene,space){if(!scene||scene.coordinateVersion===2)return scene;return{...scene,coordinateVersion:2,annotations:(scene.annotations||[]).map(a=>scaleAnnotation(a,space.scaleX,space.scaleY))};}
return{createDocumentSpace,logicalToBitmap,bitmapToLogical,logicalRectToBitmap,clientToLogical,displaySize,scaleAnnotation,normalizeLegacyScene};
});
