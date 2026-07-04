import { jsPDF } from 'jspdf';

// ----------------------------------------------------------------------
// Image Converter
// ----------------------------------------------------------------------
export const convertImage = (
  file: File, 
  targetFormat: string, 
  quality: number = 0.9,
  scale?: number,
  resizeWidth?: number,
  resizeHeight?: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      
      let targetW = img.naturalWidth;
      let targetH = img.naturalHeight;

      if (scale && scale > 0) {
        targetW = Math.round(img.naturalWidth * scale);
        targetH = Math.round(img.naturalHeight * scale);
      } else if (resizeWidth && resizeWidth > 0) {
        const ratio = img.naturalHeight / img.naturalWidth;
        targetW = resizeWidth;
        targetH = resizeHeight && resizeHeight > 0 ? resizeHeight : Math.round(resizeWidth * ratio);
      } else if (resizeHeight && resizeHeight > 0) {
        const ratio = img.naturalWidth / img.naturalHeight;
        targetH = resizeHeight;
        targetW = Math.round(resizeHeight * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const format = targetFormat.toLowerCase();

      // Handle SVG wrapping
      if (format === 'svg') {
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${img.naturalWidth}" height="${img.naturalHeight}">
  <image href="${canvas.toDataURL('image/png')}" width="${img.naturalWidth}" height="${img.naturalHeight}"/>
</svg>`;
        resolve(new Blob([svgContent], { type: 'image/svg+xml' }));
        return;
      }

      // Handle BMP conversion
      if (format === 'bmp') {
        canvasToBMP(canvas).then(resolve).catch(reject);
        return;
      }

      // Handle ICO conversion
      if (format === 'ico') {
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            createIcoFromPngBlob(pngBlob).then(resolve).catch(reject);
          } else {
            reject(new Error('Failed to render PNG for ICO conversion'));
          }
        }, 'image/png');
        return;
      }

      // Standard canvas targets
      let mimeType = 'image/png';
      if (format === 'jpg' || format === 'jpeg') {
        mimeType = 'image/jpeg';
      } else if (format === 'webp') {
        mimeType = 'image/webp';
      } else if (format === 'gif') {
        mimeType = 'image/gif';
      } else if (format === 'tiff' || format === 'tif') {
        mimeType = 'image/tiff';
      }

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // Fallback if mimeType is not natively supported by canvas.toBlob
          canvas.toBlob((fallbackBlob) => {
            if (fallbackBlob) {
              // Wrap the fallback in the correct mime type
              resolve(new Blob([fallbackBlob], { type: mimeType }));
            } else {
              reject(new Error('Image canvas to blob failed'));
            }
          }, 'image/png');
        }
      }, mimeType, format === 'webp' ? quality : 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file'));
    };
    img.src = objectUrl;
  });
};

// Canvas to BMP byte writer helper
function canvasToBMP(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const width = imgData.width;
    const height = imgData.height;
    const data = imgData.data;
    
    const extraBytes = (4 - (width * 3) % 4) % 4;
    const rgbSize = (width * 3 + extraBytes) * height;
    const totalSize = 54 + rgbSize;
    
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    
    // BMP File Header
    view.setUint8(0, 0x42); // 'B'
    view.setUint8(1, 0x4D); // 'M'
    view.setUint32(2, totalSize, true);
    view.setUint32(6, 0, true); // reserved
    view.setUint32(10, 54, true); // offset
    
    // DIB Header
    view.setUint32(14, 40, true); // header size
    view.setInt32(18, width, true);
    view.setInt32(22, height, true); // positive height means bottom-up
    view.setUint16(26, 1, true); // planes
    view.setUint16(28, 24, true); // 24-bit RGB
    view.setUint32(30, 0, true); // compression
    view.setUint32(34, rgbSize, true);
    view.setInt32(38, 2835, true); // pixels/meter
    view.setInt32(42, 2835, true);
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);
    
    // Write pixel data (bottom-up)
    let offset = 54;
    for (let y = height - 1; y >= 0; y--) {
      const rowStart = y * width * 4;
      for (let x = 0; x < width; x++) {
        const pixel = rowStart + x * 4;
        view.setUint8(offset++, data[pixel + 2]); // Blue
        view.setUint8(offset++, data[pixel + 1]); // Green
        view.setUint8(offset++, data[pixel]);     // Red
      }
      for (let i = 0; i < extraBytes; i++) {
        view.setUint8(offset++, 0);
      }
    }
    resolve(new Blob([buffer], { type: 'image/bmp' }));
  });
}

// PNG inside ICO file writer helper
function createIcoFromPngBlob(pngBlob: Blob): Promise<Blob> {
  return new Promise(async (resolve) => {
    const arrayBuffer = await pngBlob.arrayBuffer();
    const pngBytes = new Uint8Array(arrayBuffer);
    const icoBuffer = new ArrayBuffer(22 + pngBytes.length);
    const view = new DataView(icoBuffer);
    
    // ICO Header
    view.setUint16(0, 0, true); // Reserved
    view.setUint16(2, 1, true); // Type: 1 = ICO
    view.setUint16(4, 1, true); // Number of images: 1
    
    // Icon Directory Entry
    view.setUint8(6, 0); // Width: 0 (means 256)
    view.setUint8(7, 0); // Height: 0 (means 256)
    view.setUint8(8, 0); // Colors
    view.setUint8(9, 0); // Reserved
    view.setUint16(10, 1, true); // Color planes
    view.setUint16(12, 32, true); // Bits per pixel
    view.setUint32(14, pngBytes.length, true); // Image data size
    view.setUint32(18, 22, true); // Image data offset (22 bytes header)
    
    // Copy PNG bytes
    const icoBytes = new Uint8Array(icoBuffer);
    icoBytes.set(pngBytes, 22);
    
    resolve(new Blob([icoBuffer], { type: 'image/x-icon' }));
  });
}

// ----------------------------------------------------------------------
// Audio Converter (Decodes any browser-supported audio to standard WAV)
// ----------------------------------------------------------------------
export const convertAudioToWav = async (file: File): Promise<Blob> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBufferToWav(audioBuffer);
  } catch (error) {
    throw new Error('Failed to decode audio file. Make sure it is a valid audio format.');
  } finally {
    audioContext.close();
  }
};

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = raw PCM
  const bitDepth = 16;
  
  const result = numOfChan === 2 
    ? interleave(buffer.getChannelData(0), buffer.getChannelData(1))
    : buffer.getChannelData(0);
    
  const bufferArray = new ArrayBuffer(44 + result.length * 2);
  const view = new DataView(bufferArray);
  
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + result.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numOfChan, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, result.length * 2, true);
  
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([bufferArray], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// ----------------------------------------------------------------------
// Text & Formats Converter
// ----------------------------------------------------------------------
export const convertText = async (
  file: File, 
  targetFormat: string,
  textMode: 'none' | 'minify' | 'format' = 'none'
): Promise<Blob> => {
  const content = await file.text();
  const sourceFormat = file.name.split('.').pop()?.toLowerCase() || 'txt';
  let convertedText = '';
  let mimeType = 'text/plain';

  // 1. Parse content to an intermediate JSON structure if converting structured data
  if (sourceFormat === 'csv' && targetFormat === 'json') {
    const parsed = parseCSV(content);
    convertedText = JSON.stringify(parsed, null, 2);
    mimeType = 'application/json';
  } else if (sourceFormat === 'json' && targetFormat === 'csv') {
    try {
      const parsed = JSON.parse(content);
      convertedText = jsonToCSV(parsed);
      mimeType = 'text/csv';
    } catch (e) {
      throw new Error('Invalid JSON format in source file.');
    }
  } else if (sourceFormat === 'json' && targetFormat === 'xml') {
    try {
      const parsed = JSON.parse(content);
      convertedText = jsonToXML(parsed);
      mimeType = 'application/xml';
    } catch (e) {
      throw new Error('Invalid JSON format in source file.');
    }
  } else if (sourceFormat === 'xml' && targetFormat === 'json') {
    convertedText = xmlToJSONString(content);
    mimeType = 'application/json';
  } else if (sourceFormat === 'md' && targetFormat === 'html') {
    convertedText = markdownToHTML(content);
    mimeType = 'text/html';
  } else if (sourceFormat === 'html' && targetFormat === 'md') {
    convertedText = htmlToMarkdown(content);
    mimeType = 'text/markdown';
  } else if (targetFormat === 'doc' || targetFormat === 'docx') {
    convertedText = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Converted Document</title>
  <style>
    body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.5; margin: 1in; }
  </style>
</head>
<body>
  ${content.split(/\r?\n/).map(line => line.trim() ? `<p>${escapeXML(line)}</p>` : '<p>&nbsp;</p>').join('\n')}
</body>
</html>`;
    mimeType = 'application/msword';
  } else if (targetFormat === 'xls' || targetFormat === 'xlsx') {
    let rows = '';
    if (sourceFormat === 'csv') {
      const parsed = parseCSV(content);
      if (parsed.length > 0) {
        const headers = Object.keys(parsed[0]);
        rows += '<tr>' + headers.map(h => `<th style="background-color:#f1f5f9;font-weight:bold;border:1px solid #cbd5e1;padding:6px;">${escapeXML(h)}</th>`).join('') + '</tr>';
        for (const item of parsed) {
          rows += '<tr>' + headers.map(h => `<td style="border:1px solid #cbd5e1;padding:6px;">${escapeXML(item[h])}</td>`).join('') + '</tr>';
        }
      }
    } else if (sourceFormat === 'json') {
      try {
        const parsed = JSON.parse(content);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        if (arr.length > 0) {
          const headers = Object.keys(arr[0]);
          rows += '<tr>' + headers.map(h => `<th style="background-color:#f1f5f9;font-weight:bold;border:1px solid #cbd5e1;padding:6px;">${escapeXML(h)}</th>`).join('') + '</tr>';
          for (const item of arr) {
            rows += '<tr>' + headers.map(h => `<td style="border:1px solid #cbd5e1;padding:6px;">${escapeXML(String(item[h]))}</td>`).join('') + '</tr>';
          }
        }
      } catch (e) {
        rows += content.split(/\r?\n/).map(line => `<tr><td style="border:1px solid #cbd5e1;padding:6px;">${escapeXML(line)}</td></tr>`).join('\n');
      }
    } else {
      rows += content.split(/\r?\n/).map(line => `<tr><td style="border:1px solid #cbd5e1;padding:6px;">${escapeXML(line)}</td></tr>`).join('\n');
    }
    convertedText = `<html><head><meta charset="utf-8"></head><body><table style="border-collapse:collapse;">${rows}</table></body></html>`;
    mimeType = 'application/vnd.ms-excel';
  } else if (targetFormat === 'ppt' || targetFormat === 'pptx') {
    const paragraphs = content.split(/\r?\n/).filter(line => line.trim() !== '');
    convertedText = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .slide { page-break-after: always; padding: 40px; margin: 20px; border: 2px solid #6366f1; border-radius: 8px; font-family: sans-serif; background-color: #f8fafc; }
    h1 { color: #4f46e5; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; }
    p { font-size: 1.25rem; color: #1e293b; line-height: 1.6; }
  </style>
</head>
<body>
  ${paragraphs.map((para, i) => `
  <div class="slide">
    <h1>Slide ${i + 1}</h1>
    <p>${escapeXML(para)}</p>
  </div>`).join('\n')}
</body>
</html>`;
    mimeType = 'application/vnd.ms-powerpoint';
  } else {
    // Default fallback - write text out directly
    convertedText = content;
    if (targetFormat === 'json') mimeType = 'application/json';
    else if (targetFormat === 'csv') mimeType = 'text/csv';
    else if (targetFormat === 'xml') mimeType = 'application/xml';
    else if (targetFormat === 'md') mimeType = 'text/markdown';
    else if (targetFormat === 'html') mimeType = 'text/html';
  }

  let finalContent = convertedText;
  if (textMode === 'minify') {
    if (targetFormat === 'json') {
      try {
        finalContent = JSON.stringify(JSON.parse(convertedText));
      } catch (e) {
        finalContent = convertedText.replace(/\s+/g, ' ');
      }
    } else {
      finalContent = convertedText.replace(/\s+/g, ' ').replace(/>\s+</g, '><');
    }
  } else if (textMode === 'format') {
    if (targetFormat === 'json') {
      try {
        finalContent = JSON.stringify(JSON.parse(convertedText), null, 2);
      } catch (e) {}
    }
  }

  return new Blob([finalContent], { type: mimeType });
};

// Simple CSV Parser
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
}

// Simple JSON to CSV Converter
function jsonToCSV(obj: any): string {
  const arr = Array.isArray(obj) ? obj : [obj];
  if (arr.length === 0) return '';
  const headers = Object.keys(arr[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of arr) {
    const values = headers.map(header => {
      const val = row[header];
      const valStr = val === null || val === undefined ? '' : String(val);
      // Escape quotes
      return `"${valStr.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
}

// Simple JSON to XML Converter
function jsonToXML(obj: any): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
  
  function toXML(val: any, indent: string): string {
    let chunk = '';
    if (Array.isArray(val)) {
      for (const item of val) {
        chunk += `${indent}<item>\n${toXML(item, indent + '  ')}${indent}</item>\n`;
      }
    } else if (typeof val === 'object' && val !== null) {
      for (const key of Object.keys(val)) {
        const cleanKey = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const content = val[key];
        if (typeof content === 'object' && content !== null) {
          chunk += `${indent}<${cleanKey}>\n${toXML(content, indent + '  ')}${indent}</${cleanKey}>\n`;
        } else {
          const contentStr = content === null || content === undefined ? '' : String(content);
          chunk += `${indent}<${cleanKey}>${escapeXML(contentStr)}</${cleanKey}>\n`;
        }
      }
    } else {
      chunk += `${indent}${escapeXML(String(val))}\n`;
    }
    return chunk;
  }
  
  xml += toXML(obj, '  ');
  xml += '</root>';
  return xml;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Simple XML to JSON
function xmlToJSONString(xmlText: string): string {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const errorNode = xmlDoc.querySelector('parsererror');
  if (errorNode) {
    throw new Error('XML parsing error: ' + errorNode.textContent);
  }
  
  function nodeToJSON(node: Node): any {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue?.trim() || '';
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const obj: Record<string, any> = {};
      
      // attributes
      if (element.attributes.length > 0) {
        obj['@attributes'] = {};
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          obj['@attributes'][attr.nodeName] = attr.nodeValue;
        }
      }
      
      // children
      let hasElementChildren = false;
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        if (child.nodeType === Node.ELEMENT_NODE) {
          hasElementChildren = true;
          break;
        }
      }
      
      if (!hasElementChildren) {
        const textContent = element.textContent?.trim() || '';
        // If there are attributes, return object with attributes and text, otherwise just text
        if (obj['@attributes']) {
          obj['#text'] = textContent;
          return obj;
        }
        return textContent;
      }
      
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childName = child.nodeName;
          const childVal = nodeToJSON(child);
          if (obj[childName]) {
            if (!Array.isArray(obj[childName])) {
              obj[childName] = [obj[childName]];
            }
            obj[childName].push(childVal);
          } else {
            obj[childName] = childVal;
          }
        }
      }
      return obj;
    }
    return null;
  }
  
  const root = xmlDoc.documentElement;
  const jsonResult = {
    [root.nodeName]: nodeToJSON(root)
  };
  return JSON.stringify(jsonResult, null, 2);
}

// Simple Markdown to HTML
function markdownToHTML(md: string): string {
  let html = md;
  // Headings
  html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
  html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold / Italic
  html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*)\*/gim, '<em>$1</em>');
  
  // Lists (very basic bullet points)
  html = html.replace(/^\s*-\s+(.*)/gim, '<li>$1</li>');
  // Wrap list items
  html = html.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');
  
  // Paragraphs
  html = html.replace(/^\s*([^#<>\s].*)/gim, '<p>$1</p>');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Converted Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1, h2, h3 { color: #111; margin-top: 24px; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

// Simple HTML to Markdown
function htmlToMarkdown(html: string): string {
  let md = html;
  
  // Extract body if present
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    md = bodyMatch[1];
  }
  
  // Convert elements
  md = md.replace(/<h1>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<h5>([\s\S]*?)<\/h5>/gi, '##### $1\n\n');
  md = md.replace(/<h6>([\s\S]*?)<\/h6>/gi, '###### $1\n\n');
  
  md = md.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*');
  
  md = md.replace(/<li>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  
  // Clean up remaining tags
  md = md.replace(/<[^>]*>/g, '');
  
  return md.trim();
}

// ----------------------------------------------------------------------
// Document Converter (Generates PDF using jsPDF)
// ----------------------------------------------------------------------
export const convertToPDF = async (file: File): Promise<Blob> => {
  const content = await file.text();
  const name = file.name;
  const ext = name.split('.').pop()?.toLowerCase() || 'txt';
  
  const doc = new jsPDF();
  
  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Converted Document: ${name}`, 15, 20);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Original Format: ${ext.toUpperCase()} | Generated: ${new Date().toLocaleString()}`, 15, 26);
  
  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 30, 195, 30);
  
  doc.setFontSize(11);
  const margin = 15;
  const width = 180;
  const startY = 38;
  
  // Break text into lines fitting the PDF page width
  const splitText = doc.splitTextToSize(content, width);
  
  let y = startY;
  const pageHeight = doc.internal.pageSize.height;
  
  for (const line of splitText) {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20; // reset y for new page
    }
    doc.text(line, margin, y);
    y += 6; // line spacing
  }
  
  const pdfBlob = doc.output('blob');
  return pdfBlob;
};
