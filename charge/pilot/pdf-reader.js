// PDF processing stays in the browser. Submit uses the existing image-only storage contract.
(function(){
 let library;
 async function load(){
  if(!library)library=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs').then(pdf=>{pdf.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';return pdf;}).catch(e=>{library=null;throw e;});
  return library;
 }
 window.readPilotPDF=async function(file){
  const pdfjs=await load();let task,doc;
  try{
   task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});doc=await task.promise;
   if(doc.numPages>3)throw Error('Please use a receipt PDF with up to 3 pages.');
   const canvases=[],texts=[];let totalHeight=0,maxWidth=0;
   for(let n=1;n<=doc.numPages;n++){
    const page=await doc.getPage(n),base=page.getViewport({scale:1});
    if(base.width<=0||base.height<=0||base.height/base.width>5)throw Error('Unsupported PDF page size. Please use a receipt image.');
    const viewport=page.getViewport({scale:Math.min(2,1400/base.width)});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    totalHeight+=canvas.height;maxWidth=Math.max(maxWidth,canvas.width);
    if(totalHeight*maxWidth>12000000)throw Error('PDF pages are too large. Please use a smaller receipt PDF.');
    await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'rgb(255,255,255)'}).promise;
    const content=await page.getTextContent();let text='',lastY=null;
    for(const item of content.items){if(typeof item.str!=='string')continue;const y=item.transform?.[5];if(lastY!==null&&Math.abs(y-lastY)>3)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');lastY=y;}
    texts.push(text);canvases.push(canvas);page.cleanup();
   }
   const all=document.createElement('canvas');all.width=maxWidth;all.height=totalHeight;
   const context=all.getContext('2d');context.fillStyle='white';context.fillRect(0,0,all.width,all.height);let y=0;
   for(const canvas of canvases){context.drawImage(canvas,0,y);y+=canvas.height;canvas.width=canvas.height=0;}
   const blob=await new Promise(resolve=>all.toBlob(resolve,'image/png'));all.width=all.height=0;
   if(!blob||blob.size>5242880)throw Error('The rendered receipt exceeds 5 MB. Please use a smaller PDF.');
   return {text:texts.join('\n'),pages:doc.numPages,file:new File([blob],'receipt-pages.png',{type:'image/png'})};
  }catch(e){if(e.name==='PasswordException')throw Error('This PDF is password-protected. Please choose an unprotected copy.');throw e;}
  finally{if(doc)await doc.destroy();else if(task)await task.destroy();}
 };
})();
