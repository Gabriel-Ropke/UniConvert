export interface ConvertedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  category: 'image' | 'video' | 'document' | 'text' | 'audio';
  extension: string;
  targetExtension: string;
  status: 'idle' | 'converting' | 'success' | 'error';
  progress: number;
  quality?: number;
  folderPath?: string;
  resizeScale?: number;
  resizeWidth?: number;
  resizeHeight?: number;
  textMode?: 'none' | 'minify' | 'format';
  convertedBlob?: Blob;
  errorMessage?: string;
}
