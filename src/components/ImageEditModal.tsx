import React, { useState, useEffect } from 'react';
import { X, Sparkles, Download, Loader2 } from 'lucide-react';
import type { ConvertedFile } from '../types';

interface ImageEditModalProps {
  file: ConvertedFile;
  onClose: () => void;
  onAddFileToWorkspace: (file: File, folderPath?: string) => void;
}

export const ImageEditModal: React.FC<ImageEditModalProps> = ({
  file,
  onClose,
  onAddFileToWorkspace
}) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  
  // Upscale States
  const [upscaleFactor, setUpscaleFactor] = useState<2 | 4>(2);
  const [sharpenAmount, setSharpenAmount] = useState<number>(0.25); // 0 to 1
  const [isUpscaling, setIsUpscaling] = useState<boolean>(false);
  const [upscaledUrl, setUpscaledUrl] = useState<string>('');
  const [upscaledBlob, setUpscaledBlob] = useState<Blob | null>(null);
  const [originalMeta, setOriginalMeta] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Load original image
  useEffect(() => {
    let url = '';
    if (file.status === 'success' && file.convertedBlob) {
      url = URL.createObjectURL(file.convertedBlob);
    } else if (file.file) {
      url = URL.createObjectURL(file.file);
    }
    
    if (url) {
      setImageSrc(url);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setOriginalMeta({ w: img.naturalWidth, h: img.naturalHeight });
      };
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  // Sharpening filter using convolution kernel
  const applySharpening = (ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) => {
    if (amount <= 0) return;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const original = new Uint8ClampedArray(data);
    
    // Sharpening matrix convolution weights:
    // [  0, -amount,  0 ]
    // [ -amount, 1 + 4*amount, -amount ]
    // [  0, -amount,  0 ]
    const w = [
       0, -amount, 0,
      -amount, 1 + 4 * amount, -amount,
       0, -amount, 0
    ];
    
    for (let y = 1; y < height - 1; y++) {
      const yOffset = y * width;
      const prevYOffset = (y - 1) * width;
      const nextYOffset = (y + 1) * width;
      
      for (let x = 1; x < width - 1; x++) {
        const idx = (yOffset + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          let val = 0;
          val += original[(prevYOffset + (x - 1)) * 4 + c] * w[0];
          val += original[(prevYOffset + x) * 4 + c] * w[1];
          val += original[(prevYOffset + (x + 1)) * 4 + c] * w[2];
          
          val += original[(yOffset + (x - 1)) * 4 + c] * w[3];
          val += original[(yOffset + x) * 4 + c] * w[4];
          val += original[(yOffset + (x + 1)) * 4 + c] * w[5];
          
          val += original[(nextYOffset + (x - 1)) * 4 + c] * w[6];
          val += original[(nextYOffset + x) * 4 + c] * w[7];
          val += original[(nextYOffset + (x + 1)) * 4 + c] * w[8];
          
          data[idx + c] = Math.min(255, Math.max(0, val));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Upscale Image (Lanczos / High-Quality Bicubic + Sharpen)
  const runUpscale = () => {
    if (!imageSrc || isUpscaling) return;
    setIsUpscaling(true);

    setTimeout(() => {
      try {
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
          const targetW = img.naturalWidth * upscaleFactor;
          const targetH = img.naturalHeight * upscaleFactor;

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            alert('Could not initialize canvas.');
            setIsUpscaling(false);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);

          applySharpening(ctx, targetW, targetH, sharpenAmount);

          canvas.toBlob((blob) => {
            if (blob) {
              if (upscaledUrl) URL.revokeObjectURL(upscaledUrl);
              const url = URL.createObjectURL(blob);
              setUpscaledUrl(url);
              setUpscaledBlob(blob);
            }
            setIsUpscaling(false);
          }, 'image/png');
        };
      } catch (err) {
        console.error(err);
        alert('Failed to upscale image.');
        setIsUpscaling(false);
      }
    }, 200);
  };

  // Add upscaled file back to workspace
  const handleAddToWorkspace = () => {
    if (!upscaledBlob) return;
    const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const newFile = new File([upscaledBlob], `${originalName}_enhanced_${upscaleFactor}x.png`, { type: 'image/png' });
    onAddFileToWorkspace(newFile, file.folderPath);
    onClose();
  };

  // Clean up upscaled URL on unmount
  useEffect(() => {
    return () => {
      if (upscaledUrl) URL.revokeObjectURL(upscaledUrl);
    };
  }, [upscaledUrl]);

  return (
    <div className="image-edit-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(10px)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div className="image-edit-modal" style={{
        width: '100%',
        maxWidth: '1100px',
        height: '90vh',
        backgroundColor: 'var(--bg-panel)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sparkles className="w-5 h-5 text-indigo-500" style={{ color: 'var(--primary)' }} />
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Image Quality Enhancer</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                File: {file.status === 'success' && file.convertedBlob 
                  ? `${file.name.substring(0, file.name.lastIndexOf('.')) || file.name}.${file.targetExtension}`
                  : file.name} ({originalMeta.w}x{originalMeta.h} px)
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn-icon-only"
            style={{ padding: '0.5rem', borderRadius: '50%' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Column: Image Preview */}
          <div style={{
            flex: 1.2,
            backgroundColor: 'var(--bg-page)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            borderRight: '1px solid var(--border-color)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {upscaledUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', width: '100%', justifyContent: 'center' }}>
                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', width: '100%' }}>
                  <img 
                    src={upscaledUrl} 
                    alt="Enhanced Preview" 
                    style={{
                      maxHeight: '100%',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-md)'
                    }} 
                  />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 600 }}>
                  Enhanced Image Result ({originalMeta.w * upscaleFactor}x{originalMeta.h * upscaleFactor} px)
                </div>
              </div>
            ) : imageSrc ? (
              <img 
                src={imageSrc} 
                alt="Original Preview" 
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)'
                }} 
              />
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Loading image preview...</span>
            )}
          </div>

          {/* Right Column: Controls */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '2rem',
            gap: '1.5rem'
          }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}>
                <Sparkles className="w-5 h-5 text-indigo-500" style={{ color: 'var(--primary)' }} />
                Super Resolution Enhancer
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
                Upscale your image by 2x or 4x utilizing hardware-accelerated bicubic interpolation combined with an edge-sharpening convolution filter.
              </p>
            </div>

            {/* Factor selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>UP-SCALING FACTOR</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setUpscaleFactor(2)}
                  className={`btn ${upscaleFactor === 2 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem' }}
                >
                  2x Resolution ({originalMeta.w * 2}x{originalMeta.h * 2})
                </button>
                <button
                  onClick={() => setUpscaleFactor(4)}
                  className={`btn ${upscaleFactor === 4 ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '0.5rem' }}
                >
                  4x Resolution ({originalMeta.w * 4}x{originalMeta.h * 4})
                </button>
              </div>
            </div>

            {/* Sharpening factor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>SHARPENING INTENSITY</label>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
                  {Math.round(sharpenAmount * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={sharpenAmount}
                onChange={(e) => setSharpenAmount(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Recovers edge details and textures to prevent blurred pixels.
              </span>
            </div>

            <button
              onClick={runUpscale}
              disabled={isUpscaling}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: 'auto' }}
            >
              {isUpscaling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Enhancements...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Upscale & Sharpen Image
                </>
              )}
            </button>

            {/* Actions on upscaled result */}
            {upscaledUrl && (
              <div style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(79, 70, 229, 0.05)',
                border: '1px solid rgba(79, 70, 229, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Enhancement Completed!
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Dimensions increased to {originalMeta.w * upscaleFactor}x{originalMeta.h * upscaleFactor} px.
                </p>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <a
                    href={upscaledUrl}
                    download={`${file.name.substring(0, file.name.lastIndexOf('.'))}_enhanced_${upscaleFactor}x.png`}
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', textDecoration: 'none', padding: '0.5rem 0' }}
                  >
                    <Download className="w-4 h-4" />
                    Download PNG
                  </a>
                  <button
                    onClick={handleAddToWorkspace}
                    className="btn btn-primary"
                    style={{ flex: 1.2, padding: '0.5rem 0' }}
                  >
                    Add to Workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
